create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create table customers (
 id uuid primary key default gen_random_uuid(), entity text not null check(length(trim(entity))>0), account text not null check(length(trim(account))>0), name text not null check(length(trim(name))>0),
 email text, owner text not null default 'Unassigned', held boolean not null default false, hold_reason text,
 verified_on date, verification_evidence text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(entity,account), check(not held or length(trim(hold_reason))>0)
);
create table invoices (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers(id), number text not null check(length(trim(number))>0),
 currency text not null check(currency ~ '^[A-Z]{3}$'), issued_on date not null, due_on date not null, total_cents bigint not null check(total_cents between 0 and 9000000000000),
 outstanding_cents bigint not null check(outstanding_cents>=0 and outstanding_cents<=total_cents), balance_as_of date not null,
 review_required boolean not null default true, source_row jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(customer_id,number), check(due_on>=issued_on)
);
create table balance_snapshots (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references invoices(id), as_of date not null, outstanding_cents bigint not null check(outstanding_cents>=0),
 evidence text not null check(length(trim(evidence))>0), actor text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(invoice_id,as_of)
);
create table promises (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references invoices(id), amount_cents bigint not null check(amount_cents>0), due_on date not null,
 status text not null default 'open' check(status in ('open','kept','broken','cancelled')), evidence text not null check(length(trim(evidence))>0), resolution text,
 actor text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(status='open' or length(trim(resolution))>0)
);
create unique index one_open_promise on promises(invoice_id) where status='open';
create table disputes (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references invoices(id), reason text not null check(length(trim(reason))>0), owner text not null, opened_on date not null default current_date,
 review_on date not null, status text not null default 'open' check(status in ('open','resolved')), resolution text, evidence text not null check(length(trim(evidence))>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(status='open' or length(trim(resolution))>0)
);
create table activities (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers(id), kind text not null check(kind in ('note','inbound','outbound')),
 happened_on date not null, note text not null check(length(trim(note))>0), actor text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table audit (
 id uuid primary key default gen_random_uuid(), action text not null, record_id uuid, actor text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table policy (
 id uuid primary key default gen_random_uuid(), key text unique not null, days integer not null check(days between 1 and 365), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into policy(key,days) values ('balance_freshness',7),('contact_freshness',90),('quiet_days',14);
do $$ declare t text; begin foreach t in array array['customers','invoices','balance_snapshots','promises','disputes','activities','audit','policy'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop; end $$;
create function protect_history() returns trigger language plpgsql as $$ begin raise exception 'History is append-only'; end $$;
create trigger immutable_audit before update or delete on audit for each row execute function protect_history();
create trigger immutable_snapshot before update or delete on balance_snapshots for each row execute function protect_history();
create trigger immutable_activity before update or delete on activities for each row execute function protect_history();
create view invoice_work as
select i.*,c.entity,c.account,c.name as customer,c.email,c.owner,c.held,c.hold_reason,c.verified_on,
 greatest(0,current_date-i.due_on) as days_overdue,
 exists(select 1 from disputes d where d.invoice_id=i.id and d.status='open') as disputed,
 (select max(happened_on) from activities a where a.customer_id=c.id and a.kind in ('inbound','outbound')) as last_contact,
 (select due_on from promises p where p.invoice_id=i.id and p.status='open') as promise_due,
 case when i.outstanding_cents=0 then 'settled'
 when c.held then 'customer hold'
 when exists(select 1 from disputes d where d.invoice_id=i.id and d.status='open') then 'disputed'
 when i.review_required then 'import review'
 when i.balance_as_of<current_date-(select days from policy where key='balance_freshness') then 'stale balance'
 when c.email is null or c.verified_on is null or c.verified_on<current_date-(select days from policy where key='contact_freshness') then 'verify contact'
 when i.due_on>=current_date then 'not overdue'
 when exists(select 1 from promises p where p.invoice_id=i.id and p.status='open' and p.due_on>=current_date) then 'promise pending'
 else 'ready for review' end as next_action
from invoices i join customers c on c.id=i.customer_id;
create view ageing_summary as select entity,currency,
 sum(outstanding_cents) as total_cents,
 sum(case when days_overdue=0 then outstanding_cents else 0 end) as current_cents,
 sum(case when days_overdue between 1 and 30 then outstanding_cents else 0 end) as days_1_30_cents,
 sum(case when days_overdue between 31 and 60 then outstanding_cents else 0 end) as days_31_60_cents,
 sum(case when days_overdue between 61 and 90 then outstanding_cents else 0 end) as days_61_90_cents,
 sum(case when days_overdue>90 then outstanding_cents else 0 end) as days_91_plus_cents
from invoice_work group by entity,currency;
create view promise_work as select p.*,w.number,w.customer,w.entity,w.currency,w.outstanding_cents,w.next_action from promises p join invoice_work w on w.id=p.invoice_id;
create view compliance_findings as
 select id,number,customer,'CC01' as rule,'Open dispute: reminder blocked' as finding from invoice_work where disputed and outstanding_cents>0
 union all select id,number,customer,'CC02','Balance snapshot is stale' from invoice_work where outstanding_cents>0 and balance_as_of<current_date-(select days from policy where key='balance_freshness')
 union all select id,number,customer,'CC03','Contact must be verified before drafting' from invoice_work where outstanding_cents>0 and (email is null or verified_on is null or verified_on<current_date-(select days from policy where key='contact_freshness'))
 union all select id,number,customer,'CC04','Imported invoice needs review of balance and dispute status' from invoice_work where review_required
 union all select id,number,customer,'CC05','Customer contact hold is active' from invoice_work where held and outstanding_cents>0;
