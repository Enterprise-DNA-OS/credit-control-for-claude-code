insert into customers(id,entity,account,name,email,owner,held,hold_reason,verified_on,verification_evidence) values
('10000000-0000-4000-8000-000000000001','Demo NZ','NORTH','North Harbour Supply','accounts@north.example','Aroha',false,null,current_date,'Demo verified contact'),
('10000000-0000-4000-8000-000000000002','Demo NZ','SOUTH','Southern Design','accounts@south.example','Mia',false,null,current_date,'Demo verified contact'),
('10000000-0000-4000-8000-000000000003','Demo AU','COAST','Coastal Engineering','accounts@coast.example','Lee',true,'Use appointed representative',null,null),
('10000000-0000-4000-8000-000000000004','Demo NZ','NORTH2','North Harbour Services',null,'Aroha',false,null,null,null)
on conflict do nothing;
insert into invoices(id,customer_id,number,currency,issued_on,due_on,total_cents,outstanding_cents,balance_as_of,review_required) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','NZ-1001','NZD',current_date-65,current_date-35,1250000,750000,current_date,false),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','NZ-1002','NZD',current_date-90,current_date-60,480000,480000,current_date,false),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','AU-2001','AUD',current_date-145,current_date-115,2000000,2000000,current_date-10,false),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','NZ-1003','NZD',current_date-20,current_date+10,300000,300000,current_date,false),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000004','NZ-1004','NZD',current_date-50,current_date-20,175000,175000,current_date-12,true),
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002','NZ-0999','NZD',current_date-90,current_date-60,90000,0,current_date,false)
on conflict do nothing;
insert into balance_snapshots(invoice_id,as_of,outstanding_cents,evidence,actor) select id,balance_as_of,outstanding_cents,'Synthetic demo ledger','Demo seed' from invoices where number in ('NZ-1001','NZ-1002','AU-2001','NZ-1003','NZ-1004','NZ-0999') on conflict do nothing;
insert into promises(id,invoice_id,amount_cents,due_on,evidence,actor) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',300000,current_date-2,'Demo customer call','Aroha') on conflict do nothing;
insert into disputes(id,invoice_id,reason,owner,review_on,evidence) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','Delivery quantity needs confirmation','Mia',current_date-1,'Demo delivery query') on conflict do nothing;
insert into activities(id,customer_id,kind,happened_on,note,actor) values
('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','inbound',current_date-18,'Requested a split payment. Confirm before any follow-up.','Aroha') on conflict do nothing;
