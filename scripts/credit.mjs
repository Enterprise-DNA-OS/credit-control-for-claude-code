#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb, REPO_ROOT} from './lib/db.mjs';
import {table} from './lib/format.mjs';
import {parseCsv} from './lib/csv.mjs';

export const reads={
 customers:'select id,entity,account,name,email,owner,held,verified_on from customers order by entity,name',
 invoices:'select id,entity,customer,number,currency,outstanding_cents,due_on,days_overdue,next_action from invoice_work order by days_overdue desc,number',
 ageing:'select * from ageing_summary order by entity,currency',
 'chase-list':"select entity,customer,number,currency,outstanding_cents,days_overdue,owner from invoice_work where next_action='ready for review' order by days_overdue desc,number",
 'promises-due':"select id,customer,number,currency,amount_cents,due_on,status,next_action from promise_work where status='open' and due_on<=current_date+7 order by due_on,number",
 disputes:"select d.id,w.customer,w.number,d.reason,d.owner,d.review_on,d.status from disputes d join invoice_work w on w.id=d.invoice_id where d.status='open' order by d.review_on,w.number",
 attention:"select customer,number,currency,outstanding_cents,days_overdue,last_contact,promise_due,next_action from invoice_work where outstanding_cents>0 and (due_on<current_date or last_contact is null or last_contact<current_date-(select days from policy where key='quiet_days')) order by days_overdue desc,number",
 exposure:"select customer_id,entity,account,customer,owner,currency,sum(outstanding_cents) as outstanding_cents,sum(case when disputed then outstanding_cents else 0 end) as disputed_cents,max(days_overdue) as oldest_days from invoice_work group by customer_id,entity,account,customer,owner,currency order by sum(outstanding_cents) desc,customer",
 activity:'select a.id,c.name as customer,a.kind,a.happened_on,a.note,a.actor from activities a join customers c on c.id=a.customer_id order by a.happened_on desc,a.id',
 compliance:'select * from compliance_findings order by rule,number',
 'source-check':'select entity,customer,number,currency,balance_as_of,review_required,current_date-balance_as_of as snapshot_age_days from invoice_work where outstanding_cents>0 order by balance_as_of,number',
 'promise-plan':"select entity,currency,due_on,sum(least(amount_cents,outstanding_cents)) as promised_cents,count(*) as promises from promise_work where status='open' and due_on>=current_date and outstanding_cents>0 and next_action='promise pending' group by entity,currency,due_on order by due_on,entity,currency",
 history:'select action,record_id,actor,detail,created_at from audit order by created_at,id',
 policy:'select key,days from policy order by key'
};
export const usage={
 ...Object.fromEntries(Object.keys(reads).map(k=>[k,k])),
 customer:'customer <name-or-id>', invoice:'invoice <number-or-id>', 'weekly-review':'weekly-review',
 'add-customer':'add-customer --entity= --account= --name= --owner= --actor=',
 add:'add --customer= --number= --currency= --issued=YYYY-MM-DD --due=YYYY-MM-DD --total= --outstanding= --as-of=YYYY-MM-DD --evidence= --actor=',
 verify:'verify <customer> --email= --evidence= --actor=',
 hold:'hold <customer> --reason= --actor=', release:'release <customer> --evidence= --actor=',
 reconcile:'reconcile <invoice> --outstanding= --as-of=YYYY-MM-DD --evidence= --reviewed --actor=',
 promise:'promise <invoice> --amount= --due=YYYY-MM-DD --evidence= --actor=',
 'close-promise':'close-promise <promise-id> --status=kept|broken|cancelled --evidence= --actor=',
 dispute:'dispute <invoice> --reason= --owner= --review-on=YYYY-MM-DD --evidence= --actor=',
 'resolve-dispute':'resolve-dispute <dispute-id> --resolution= --evidence= --actor=',
 log:'log <customer> --kind=note|inbound|outbound --on=YYYY-MM-DD --note= --actor=',
 import:'import chaser --file= --entity= --as-of=YYYY-MM-DD --actor= [--currency=NZD] [--map=examples/import-map.json] [--dry-run]',
 export:'export --file=exports/backup.json',
 'draft-reminder':'draft-reminder <invoice> --actor=',
 'draft-review':'draft-review --actor='
};
export function parse(args){const opts={},pos=[];for(const a of args){if(a.startsWith('--')){const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(k in opts)throw Error(`Repeated --${k}`);opts[k]=i<0?true:a.slice(i+1);}else pos.push(a);}return {opts,pos};}
const required=(o,k)=>{const v=o[k];if(typeof v!=='string'||!v.trim())throw Error(`--${k} is required`);return v.trim();};
export function cents(v){const s=String(v).trim();if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Money must be nonnegative decimal units, at most two decimals, without currency symbols or separators');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>9000000000000)throw Error('Amount too large');return n;}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Use a valid YYYY-MM-DD date');return v;}
const today=()=>new Date().toISOString().slice(0,10);
function past(v){v=date(v);if(v>today())throw Error('Snapshot or activity cannot be in the future');return v;}
function currency(v){if(!/^[A-Z]{3}$/.test(v))throw Error('Currency must be three uppercase letters');return v;}
const allowed={
 'add-customer':['entity','account','name','owner'], add:['customer','number','currency','issued','due','total','outstanding','as-of','evidence'],
 verify:['email','evidence'],hold:['reason'],release:['evidence'],reconcile:['outstanding','as-of','evidence','reviewed'],promise:['amount','due','evidence'],
 'close-promise':['status','evidence'],dispute:['reason','owner','review-on','evidence'],'resolve-dispute':['resolution','evidence'],log:['kind','on','note'],
 import:['file','entity','as-of','currency','map','dry-run'],export:['file'],'draft-reminder':[],'draft-review':[]
};
const tx=async(db,fn)=>{await db.exec('BEGIN');try{const r=await fn();await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}};
async function resolve(db,t,label,needle){if(!needle)throw Error(`Provide ${t} name or id`);const rows=await db.query(`select * from ${t} where id::text like $1 or lower(${label})=lower($2) order by id`,[needle+'%',needle]);let matches=rows;if(!matches.length)matches=await db.query(`select * from ${t} where position(lower($1) in lower(${label}))>0 order by id`,[needle]);if(matches.length!==1){const err=Error(matches.length?'Ambiguous record; use the full id':'No matching record');err.candidates=matches.map(r=>({id:r.id,name:r[label],entity:r.entity,account:r.account}));throw err;}return matches[0];}
async function audit(db,action,id,actor,detail){await db.query('insert into audit(action,record_id,actor,detail) values($1,$2,$3,$4)',[action,id,actor,JSON.stringify(detail)]);}
async function snapshot(db,i,amount,asof,evidence,actor){if(amount>Number(i.total_cents))throw Error('Outstanding exceeds invoice total');if(asof<i.issued_on)throw Error('Balance snapshot predates invoice');if(asof<i.balance_as_of)throw Error('Older balance snapshot refused');const old=(await db.query('select * from balance_snapshots where invoice_id=$1 and as_of=$2',[i.id,asof]))[0];if(old&&Number(old.outstanding_cents)!==amount)throw Error('Conflicting balance for the same date; reconcile the source and use a later snapshot');if(!old)await db.query('insert into balance_snapshots(invoice_id,as_of,outstanding_cents,evidence,actor) values($1,$2,$3,$4,$5)',[i.id,asof,amount,evidence,actor]);await db.query('update invoices set outstanding_cents=$2,balance_as_of=$3 where id=$1',[i.id,amount,asof]);}
async function detail(db,cmd,needle){if(cmd==='customer'){const c=await resolve(db,'customers','name',needle);return {customer:c,invoices:await db.query('select * from invoice_work where customer_id=$1 order by number',[c.id]),activities:await db.query('select * from activities where customer_id=$1 order by happened_on,id',[c.id])};}const i=await resolve(db,'invoices','number',needle);const result={invoice:(await db.query('select * from invoice_work where id=$1',[i.id]))[0]};for(const t of ['balance_snapshots','promises','disputes'])result[t]=await db.query(`select * from ${t} where invoice_id=$1 order by created_at,id`,[i.id]);return result;}
async function review(db){return {ageing:await db.query(reads.ageing),attention:await db.query(reads.attention),promises:await db.query(reads['promises-due']),disputes:await db.query(reads.disputes),compliance:await db.query(reads.compliance)};}
function draftFile(name,content){const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`${name}-${randomUUID()}.md`);fs.writeFileSync(file,content,{flag:'wx',mode:0o600});return file;}

export async function run(db,args){
 const {opts:o,pos}=parse(args);const cmd=pos.shift()||'help';
 if(cmd==='help'||o.help)return Object.entries(usage).map(([command,syntax])=>({command,syntax}));
 for(const flag of ['json','dry-run','reviewed'])if(flag in o&&o[flag]!==true)throw Error(`--${flag} is a boolean flag without a value`);
 if(!(cmd in usage))throw Error(`Unknown command ${cmd}`);
 for(const key of Object.keys(o))if(!['json','actor',...(allowed[cmd]||[])].includes(key))throw Error(`Unknown option --${key} for ${cmd}`);
 const takesPos=['customer','invoice','verify','hold','release','reconcile','promise','close-promise','dispute','resolve-dispute','log','import','draft-reminder'];
 if(pos.length!==(takesPos.includes(cmd)?1:0))throw Error(`Usage: ${usage[cmd]}`);
 if(cmd in reads)return db.query(reads[cmd]);
 if(['customer','invoice'].includes(cmd))return detail(db,cmd,pos[0]);
 if(cmd==='weekly-review')return review(db);
 if(cmd==='export'){
 const file=path.resolve(REPO_ROOT,required(o,'file'));const data=await tx(db,async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const out={version:1,exported_at:new Date().toISOString()};for(const t of ['customers','invoices','balance_snapshots','promises','disputes','activities','audit','policy'])out[t]=await db.query(`select * from ${t} order by id`);return out;});
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return {file,records:Object.values(data).filter(Array.isArray).reduce((n,a)=>n+a.length,0)};
 }
 const actor=required(o,'actor');
 if(cmd==='import')return importChaser(db,pos[0],o,actor);
 if(cmd==='draft-review'){const r=await review(db);const file=draftFile('weekly-review',`# Internal credit-control review\n\nPrepared for review by ${actor}. Snapshot ${today()}. No messages sent.\n\n${human(r)}\n\nPromise amounts are customer commitments, not a forecast of receipts. Currency totals are separate.\n`);return {file};}
 if(cmd==='draft-reminder'){
 const data=await detail(db,'invoice',pos[0]),i=data.invoice;
 if(i.next_action!=='ready for review')throw Error(`Draft blocked: ${i.next_action}`);
 const file=draftFile('reminder',`# DRAFT: review before sending\n\nTo: ${i.email}\nSubject: Invoice ${i.number}\n\nHello ${i.customer},\n\nOur invoice record shows ${i.currency} ${(Number(i.outstanding_cents)/100).toFixed(2)} outstanding on invoice ${i.number}, due ${i.due_on}. The balance was checked as at ${i.balance_as_of}. Please let us know if a payment or invoice query needs matching to this record.\n\nThank you.\n\n## Internal review\nPrepared by ${actor}. Recheck payment allocations, disputes and recipient immediately before sending. This draft adds no fees or legal threats.\n`);return {file};
 }
 return tx(db,async()=>{
 // Serialise mutations against the same customer or invoice; changes and audit land together.
 let result,id;
 if(cmd==='add-customer'){
 result=(await db.query('insert into customers(entity,account,name,owner) values($1,$2,$3,$4) returning *',[required(o,'entity'),required(o,'account'),required(o,'name'),required(o,'owner')]))[0];id=result.id;
 }else if(cmd==='add'){
 const c=await resolve(db,'customers','name',required(o,'customer'));const issued=past(required(o,'issued')),due=date(required(o,'due')),asof=past(required(o,'as-of'));
 if(asof<issued)throw Error('Snapshot predates invoice');
 const total=cents(required(o,'total')),amount=cents(required(o,'outstanding')),evidence=required(o,'evidence');
 result=(await db.query('insert into invoices(customer_id,number,currency,issued_on,due_on,total_cents,outstanding_cents,balance_as_of,review_required) values($1,$2,$3,$4,$5,$6,$7,$8,false) returning *',[c.id,required(o,'number'),currency(required(o,'currency')),issued,due,total,amount,asof]))[0];id=result.id;await snapshot(db,result,amount,asof,evidence,actor);
 }else if(['verify','hold','release','log'].includes(cmd)){
 const c=await resolve(db,'customers','name',pos[0]);await db.query('select id from customers where id=$1 for update',[c.id]);id=c.id;
 if(cmd==='verify'){const email=required(o,'email');if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw Error('Invalid email');result=(await db.query('update customers set email=$2,verified_on=current_date,verification_evidence=$3 where id=$1 returning *',[c.id,email,required(o,'evidence')]))[0];}
 if(cmd==='hold')result=(await db.query('update customers set held=true,hold_reason=$2 where id=$1 returning *',[c.id,required(o,'reason')]))[0];
 if(cmd==='release'){required(o,'evidence');if(!c.held)throw Error('Customer is not held');result=(await db.query('update customers set held=false,hold_reason=null where id=$1 returning *',[c.id]))[0];}
 if(cmd==='log')result=(await db.query('insert into activities(customer_id,kind,happened_on,note,actor) values($1,$2,$3,$4,$5) returning *',[c.id,required(o,'kind'),past(required(o,'on')),required(o,'note'),actor]))[0];
 }else if(cmd==='close-promise'){
 const p=await resolve(db,'promises','id::text',pos[0]);const locked=(await db.query('select * from promises where id=$1 for update',[p.id]))[0];if(locked.status!=='open')throw Error('Promise already closed');const status=required(o,'status');if(!['kept','broken','cancelled'].includes(status))throw Error('Use kept, broken or cancelled');id=p.id;result=(await db.query('update promises set status=$2,resolution=$3 where id=$1 returning *',[p.id,status,required(o,'evidence')]))[0];
 }else if(cmd==='resolve-dispute'){
 const d=await resolve(db,'disputes','id::text',pos[0]);const locked=(await db.query('select * from disputes where id=$1 for update',[d.id]))[0];if(locked.status!=='open')throw Error('Dispute already resolved');required(o,'evidence');id=d.id;result=(await db.query("update disputes set status='resolved',resolution=$2 where id=$1 returning *",[d.id,required(o,'resolution')]))[0];
 }else{
 const ref=await resolve(db,'invoices','number',pos[0]);const i=(await db.query('select * from invoices where id=$1 for update',[ref.id]))[0];id=i.id;
 if(cmd==='reconcile'){
 if(o.reviewed!==true)throw Error('--reviewed confirms balances and dispute status were checked');await snapshot(db,i,cents(required(o,'outstanding')),past(required(o,'as-of')),required(o,'evidence'),actor);result=(await db.query('update invoices set review_required=false where id=$1 returning *',[i.id]))[0];
 }else if(cmd==='promise'){
 const amount=cents(required(o,'amount'));if(amount===0||amount>Number(i.outstanding_cents))throw Error('Promise must be positive and no larger than outstanding');result=(await db.query('insert into promises(invoice_id,amount_cents,due_on,evidence,actor) values($1,$2,$3,$4,$5) returning *',[i.id,amount,date(required(o,'due')),required(o,'evidence'),actor]))[0];
 }else if(cmd==='dispute'){
 result=(await db.query('insert into disputes(invoice_id,reason,owner,review_on,evidence) values($1,$2,$3,$4,$5) returning *',[i.id,required(o,'reason'),required(o,'owner'),date(required(o,'review-on')),required(o,'evidence')]))[0];
 }else throw Error('Unimplemented command '+cmd);
 }
 await audit(db,cmd,id,actor,o);return result;
 });
}

const aliases={account:['Customer ID','Customer account','Account'],customer:['Customer','Customer name'],number:['Invoice number','Invoice Number'],currency:['Currency','Currency code'],issued:['Issue date','Invoice date','Date'],due:['Due date'],total:['Initial value','Total','Invoice amount'],outstanding:['Outstanding value','Outstanding amount','Amount due']};
async function importChaser(db,vendor,o,actor){
 if(vendor!=='chaser')throw Error('Import supports chaser');
 const file=path.resolve(REPO_ROOT,required(o,'file')),entity=required(o,'entity'),asof=past(required(o,'as-of'));
 const map=o.map?JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT,o.map),'utf8')):{};
 for(const [k,v] of Object.entries(map))if(!(k in aliases)||typeof v!=='string'||!v)throw Error('Invalid import mapping '+k);
 const rows=parseCsv(fs.readFileSync(file,'utf8'));if(!rows.length)throw Error('CSV contains no records');
 const value=(row,k)=>{const names=map[k]?[map[k]]:aliases[k];const matches=Object.keys(row).filter(h=>names.some(n=>n.toLowerCase()===h.toLowerCase()));if(matches.length>1)throw Error('Ambiguous columns for '+k);return matches.length?String(row[matches[0]]).trim():'';};
 const seen=new Set();
 const normal=rows.map((row,index)=>{try{
 const customer=value(row,'customer'),account=value(row,'account')||customer,number=value(row,'number');
 if(!customer||!account||!number)throw Error('Customer and invoice number required');
 const issued=past(value(row,'issued')),due=date(value(row,'due')),cur=currency(value(row,'currency')||required(o,'currency'));
 const total=cents(value(row,'total')),outstanding=cents(value(row,'outstanding'));if(outstanding>total||due<issued||asof<issued)throw Error('Invalid balance or date range');
 const key=JSON.stringify([account,number]);if(seen.has(key))throw Error('Duplicate invoice in this file');seen.add(key);
 return {customer,account,number,issued,due,currency:cur,total,outstanding,raw:row};
 }catch(e){throw Error(`Row ${index+2}: ${e.message}`);}});
 return tx(db,async()=>{
 let added=0,updated=0,unchanged=0;
 for(const row of normal){
 let c=(await db.query('select * from customers where entity=$1 and account=$2 for update',[entity,row.account]))[0];
 if(!c)c=(await db.query('insert into customers(entity,account,name) values($1,$2,$3) returning *',[entity,row.account,row.customer]))[0];
 if(c.name!==row.customer)throw Error('Customer identity changed for '+row.account+'; review mapping');
 let i=(await db.query('select * from invoices where customer_id=$1 and number=$2 for update',[c.id,row.number]))[0];
 if(!i){i=(await db.query('insert into invoices(customer_id,number,currency,issued_on,due_on,total_cents,outstanding_cents,balance_as_of,source_row) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[c.id,row.number,row.currency,row.issued,row.due,row.total,row.outstanding,asof,JSON.stringify(row.raw)]))[0];added++;}
 else{
 if(i.currency!==row.currency||Number(i.total_cents)!==row.total||i.issued_on!==row.issued||i.due_on!==row.due)throw Error('Invoice identity, dates or total changed for '+row.number+'; review before importing');
 if(i.balance_as_of===asof&&Number(i.outstanding_cents)===row.outstanding){if((Object.keys(i.source_row).length!==Object.keys(row.raw).length||Object.keys(i.source_row).some(k=>String(i.source_row[k])!==String(row.raw[k]))) )throw Error('Changed source fields for the same snapshot; review export');unchanged++;continue;}
 updated++;
 }
 await snapshot(db,i,row.outstanding,asof,`Chaser export ${path.basename(file)}`,actor);
 await db.query('update invoices set source_row=$2,review_required=true where id=$1',[i.id,JSON.stringify(row.raw)]);
 await audit(db,'import',i.id,actor,{entity,asof,file:path.basename(file),source:row.raw});
 }
 if(o['dry-run']){await db.exec('ROLLBACK');await db.exec('BEGIN');}
 return {rows:normal.length,added,updated,unchanged,dry_run:!!o['dry-run'],review:'Imported invoices require reconciliation and verified contacts before drafts'};
 });
}

export function human(value){
 if(Array.isArray(value)){if(!value.length)return '(none)';const keys=[...new Set(value.flatMap(Object.keys))];return table(value,keys.map(key=>({key,label:key.replace(/_cents$/,'').replace(/_/g,' '),format:(v)=>v==null?'':key.endsWith('_cents')?(Number(v)/100).toFixed(2):typeof v==='object'?JSON.stringify(v):String(v)})));}
 if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}\n${typeof v==='object'?human(v):String(v)}`).join('\n\n');
 return String(value);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):human(result));}catch(e){if(process.argv.includes('--json'))console.error(JSON.stringify({error:e.message,candidates:e.candidates||[]}));else{console.error(e.message);if(e.candidates?.length)console.error(human(e.candidates));}process.exitCode=1;}finally{if(db)await db.close();}}
