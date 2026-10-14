-- Run in SQL Editor as project owner. All fixtures and writes roll back.
begin;
create temporary table fixture(k text primary key,id uuid not null default gen_random_uuid());
insert into fixture(k) values('a'),('b'),('hr'),('admin'),('department'),('round'),('job'),('job2'),('closed_round'),('closed_job'),('exam');
create temporary table checks(label text,passed boolean);
grant select,insert,update on fixture,checks to authenticated,anon;
create function pg_temp.assert_ok(p boolean,label text) returns void language plpgsql as $$begin if p is distinct from true then raise exception 'TEST_FAILED: %',label;end if;insert into checks values(label,true);end $$;
insert into auth.users(id,email,raw_user_meta_data)
select id,k||'-recruitment-test@example.invalid','{"first_name":"ข้อมูลทดสอบ","last_name":"ระบบ","consent_version":"draft-1","role":"admin"}'::jsonb from fixture where k in ('a','b','hr','admin');
update public.user_roles set role='admin' where user_id=(select id from fixture where k='admin');
update public.user_roles set role='hr',permissions=array['review','payments','manage_jobs','exams','publish','reports'] where user_id=(select id from fixture where k='hr');
insert into public.departments(id,name) select id,'ข้อมูลทดสอบหน่วยงาน' from fixture where k='department';
insert into public.recruitment_rounds(id,name,year_be,opens_at,closes_at,max_per_user,published)
select id,'ข้อมูลทดสอบรอบ',2569,now()-interval '1 day',now()+interval '1 day',1,true from fixture where k='round';
insert into public.recruitment_rounds(id,name,year_be,opens_at,closes_at,published)
select id,'ข้อมูลทดสอบรอบปิด',2569,now()-interval '2 days',now()-interval '1 day',true from fixture where k='closed_round';
insert into public.job_positions(id,round_id,department_id,title,category,employment_type,vacancies,required_documents,published)
select f.id,r.id,d.id,'ข้อมูลทดสอบตำแหน่ง','support','ทดสอบ',1,'[{"key":"photo","label":"รูป","required":true}]',true
from fixture f cross join fixture r cross join fixture d where f.k in ('job','job2') and r.k='round' and d.k='department';
insert into public.job_positions(id,round_id,department_id,title,category,employment_type,vacancies,required_documents,published)
select f.id,r.id,d.id,'ข้อมูลทดสอบปิดรับ','support','ทดสอบ',1,'[]',true from fixture f cross join fixture r cross join fixture d where f.k='closed_job' and r.k='closed_round' and d.k='department';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='a'),'role','authenticated')::text,true);
select pg_temp.assert_ok((select role='applicant' from public.user_roles where user_id=auth.uid()),'user_metadata role cannot elevate signup');
insert into fixture(k,id) values('app_a',public.save_application(null,(select id from fixture where k='job'),'{"prefix":"นาย","first_name":"ข้อมูลทดสอบ","last_name":"ก","birth_date":"1990-01-01","phone":"0800000000","address":"ที่อยู่ทดสอบ"}','[{"degree":"ปริญญาตรี","major":"ทดสอบ","institution":"ทดสอบ","graduation_year":2560,"gpa":3}]','[]'));
do $$begin
 begin perform public.submit_application((select id from fixture where k='app_a'),'draft-1');raise exception 'missing documents accepted';exception when others then if sqlerrm not like '%DOCUMENTS_REQUIRED%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'required documents checked on server');
 begin perform public.save_application(null,(select id from fixture where k='closed_job'),'{}','[]','[]');raise exception 'closed round accepted';exception when others then if sqlerrm not like '%ROUND_CLOSED%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'closed round rejected on server');
 begin update public.user_roles set role='admin' where user_id=auth.uid();raise exception 'role changed';exception when insufficient_privilege then null;end;
 perform pg_temp.assert_ok(true,'direct role update blocked');
 begin update public.applications set payment_status='confirmed' where user_id=auth.uid();raise exception 'payment approved';exception when insufficient_privilege then null;end;
 perform pg_temp.assert_ok(true,'direct payment approval blocked');
 begin perform public.admin_save('departments','{"name":"attack"}');raise exception 'admin API accepted';exception when others then if sqlerrm not like '%FORBIDDEN%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'applicant cannot call admin mutation');
end $$;
reset role;
insert into storage.objects(bucket_id,name,metadata) select 'application-files',a.id||'/'||b.id||'/test.jpg','{"mimetype":"image/jpeg","size":10}' from fixture a cross join fixture b where a.k='a' and b.k='app_a';
select public.complete_upload((select id from fixture where k='a'),(select id from fixture where k='app_a'),'photo',(select a.id||'/'||b.id||'/test.jpg' from fixture a cross join fixture b where a.k='a' and b.k='app_a'),'test.jpg','image/jpeg',10);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='a'),'role','authenticated')::text,true);
select public.submit_application((select id from fixture where k='app_a'),'draft-1');
select pg_temp.assert_ok(public.submit_application((select id from fixture where k='app_a'),'draft-1')=(select application_number from public.applications where id=(select id from fixture where k='app_a')),'repeated submit is idempotent');
update public.profiles set first_name='ชื่อใหม่' where id=auth.uid();
select pg_temp.assert_ok((select snapshot->'personal'->>'first_name'='ข้อมูลทดสอบ' from public.applications where id=(select id from fixture where k='app_a')),'submitted snapshot survives profile changes');
select pg_temp.assert_ok((select count(*)=1 from storage.objects where bucket_id='application-files'),'owner can read own storage object');
do $$begin
 begin perform public.save_application((select id from fixture where k='app_a'),(select id from fixture where k='job'),'{}','[]','[]');raise exception 'submitted form edited';exception when others then if sqlerrm not like '%APPLICATION_LOCKED%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'submitted application locks edits');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='b'),'role','authenticated')::text,true);
select pg_temp.assert_ok((select count(*)=0 from public.applications),'B cannot read A application');
select pg_temp.assert_ok((select count(*)=0 from public.application_documents),'B cannot read A documents');
select pg_temp.assert_ok((select count(*)=0 from storage.objects where bucket_id='application-files'),'B cannot read A storage object');
do $$begin
 begin perform public.check_upload((select id from fixture where k='app_a'),'photo');raise exception 'other upload accepted';exception when others then if sqlerrm not like '%FORBIDDEN%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'B cannot upload against A application');
 begin perform public.complete_upload(auth.uid(),(select id from fixture where k='app_a'),'photo','fake','fake.jpg','image/jpeg',10);raise exception 'service function callable';exception when insufficient_privilege then null;end;
 perform pg_temp.assert_ok(true,'upload completion is service-only');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='hr'),'role','authenticated')::text,true);
do $$begin
 begin perform public.review_application((select id from fixture where k='app_a'),'eligible','',null);raise exception 'transition skipped';exception when others then if sqlerrm not like '%INVALID_TRANSITION%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'invalid state transition rejected');
end $$;
select public.review_application((select id from fixture where k='app_a'),'under_review');
select public.review_application((select id from fixture where k='app_a'),'needs_correction','แก้ที่อยู่',now()+interval '1 hour');
insert into public.staff_notes(application_id,author_id,note) values((select id from fixture where k='app_a'),auth.uid(),'บันทึกภายในทดสอบ');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='a'),'role','authenticated')::text,true);
select pg_temp.assert_ok((select count(*)=0 from public.staff_notes),'applicant cannot read internal notes');
select public.save_application((select id from fixture where k='app_a'),(select id from fixture where k='job'),'{"prefix":"นาย","first_name":"ข้อมูลทดสอบ","last_name":"ก","birth_date":"1990-01-01","phone":"0800000000","address":"ที่อยู่แก้ไข"}','[{"degree":"ปริญญาตรี","major":"ทดสอบ","institution":"ทดสอบ"}]','[]');
select public.submit_application((select id from fixture where k='app_a'),'draft-1');
select pg_temp.assert_ok((select snapshot->'personal'->>'address'='ที่อยู่แก้ไข' from public.applications where id=(select id from fixture where k='app_a')),'correction can be saved and resubmitted');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='hr'),'role','authenticated')::text,true);
select public.review_application((select id from fixture where k='app_a'),'under_review');
select public.review_application((select id from fixture where k='app_a'),'eligible');
select public.admin_save('exam_schedules',jsonb_build_object('id',(select id from fixture where k='exam'),'job_id',(select id from fixture where k='job'),'title','ข้อมูลทดสอบการสอบ','exam_at',now()+interval '1 day','venue','สถานที่ทดสอบ','published',true));
select public.admin_save('exam_assignments',jsonb_build_object('application_id',(select id from fixture where k='app_a'),'schedule_id',(select id from fixture where k='exam'),'exam_number','TEST-001'));
select public.admin_save('selection_results',jsonb_build_object('application_id',(select id from fixture where k='app_a'),'score',80,'outcome','selected'));
select public.publish_results((select id from fixture where k='job'),'selection','ข้อมูลทดสอบผล');
select pg_temp.assert_ok((select not (rows->0 ?| array['phone','address','national_id','score','storage_path']) from public.published_results where job_id=(select id from fixture where k='job')),'published result has only allowlisted public fields');
select pg_temp.assert_ok(public.staff_dashboard(jsonb_build_object('job',(select id from fixture where k='job')))->>'total'='1','dashboard follows selected job');
select pg_temp.assert_ok(public.staff_list(jsonb_build_object('search','ข้อมูลทดสอบ'),0,20,'number')->>'count'='1','staff paginated search works');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='a'),'role','authenticated')::text,true);
select pg_temp.assert_ok((select count(*)=1 from public.exam_assignments),'exam card available after published schedule');
select pg_temp.assert_ok((select count(*)=1 from public.selection_results),'owner can see approved result');
insert into fixture(k,id) values('app_second',public.save_application(null,(select id from fixture where k='job2'),'{"prefix":"นาย","first_name":"ข้อมูลทดสอบ","last_name":"ก","birth_date":"1990-01-01","phone":"0800000000","address":"ที่อยู่ทดสอบ"}','[{"degree":"ปริญญาตรี","major":"ทดสอบ","institution":"ทดสอบ"}]','[]'));
do $$begin
 begin perform public.submit_application((select id from fixture where k='app_second'),'draft-1');raise exception 'quota accepted';exception when others then if sqlerrm not like '%ROUND_QUOTA%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'round application quota enforced on server');
 begin perform public.save_application(null,(select id from fixture where k='job'),'{}','[]','[]');raise exception 'duplicate accepted';exception when others then if sqlerrm not like '%DUPLICATE_APPLICATION%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'duplicate position application blocked');
end $$;
reset role;
update public.applications set status='needs_correction',correction_deadline=now()-interval '1 minute' where id=(select id from fixture where k='app_second');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='a'),'role','authenticated')::text,true);
do $$begin
 begin perform public.save_application((select id from fixture where k='app_second'),(select id from fixture where k='job2'),'{}','[]','[]');raise exception 'expired correction accepted';exception when others then if sqlerrm not like '%APPLICATION_LOCKED%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'expired correction deadline enforced');
end $$;
reset role;
insert into fixture(k) values('fee_job');
insert into public.job_positions(id,round_id,department_id,title,category,employment_type,vacancies,required_documents,fee_amount,published)
select f.id,r.id,d.id,'ข้อมูลทดสอบค่าธรรมเนียม','support','ทดสอบ',1,'[]',100,true from fixture f cross join fixture r cross join fixture d where f.k='fee_job' and r.k='round' and d.k='department';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='b'),'role','authenticated')::text,true);
insert into fixture(k,id) values('fee_app',public.save_application(null,(select id from fixture where k='fee_job'),'{"prefix":"นาย","first_name":"ข้อมูลทดสอบ","last_name":"ข","birth_date":"1990-01-01","phone":"0800000001","address":"ที่อยู่ทดสอบ"}','[{"degree":"ปริญญาตรี","major":"ทดสอบ","institution":"ทดสอบ"}]','[]'));
select public.submit_application((select id from fixture where k='fee_app'),'draft-1');
select pg_temp.assert_ok((select payment_status='awaiting_payment' from public.applications where id=(select id from fixture where k='fee_app')),'fee module starts with awaiting payment');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='hr'),'role','authenticated')::text,true);
select public.review_application((select id from fixture where k='fee_app'),'under_review');
do $$begin
 begin perform public.review_application((select id from fixture where k='fee_app'),'eligible');raise exception 'unpaid eligibility accepted';exception when others then if sqlerrm not like '%PAYMENT_REQUIRED%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'unpaid application cannot pass eligibility');
end $$;
reset role;
insert into storage.objects(bucket_id,name,metadata) select 'application-files',a.id||'/'||b.id||'/slip.png','{"mimetype":"image/png","size":10}' from fixture a cross join fixture b where a.k='b' and b.k='fee_app';
do $$begin
 begin perform public.complete_upload((select id from fixture where k='b'),(select id from fixture where k='fee_app'),'payment','fake','fake.html','text/html',10);raise exception 'bad file accepted';exception when others then if sqlerrm not like '%INVALID_FILE%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'backend rejects unsupported file MIME');
end $$;
select public.complete_upload((select id from fixture where k='b'),(select id from fixture where k='fee_app'),'payment',(select a.id||'/'||b.id||'/slip.png' from fixture a cross join fixture b where a.k='b' and b.k='fee_app'),'slip.png','image/png',10);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='b'),'role','authenticated')::text,true);
insert into fixture(k,id) values('payment',public.save_payment((select id from fixture where k='fee_app'),100,now()-interval '1 minute',(select id::text from fixture where k='fee_app')));
select pg_temp.assert_ok((select payment_status='pending' from public.applications where id=(select id from fixture where k='fee_app')),'upload does not confirm payment');
do $$begin
 begin perform public.review_payment((select id from fixture where k='payment'),true,'');raise exception 'self approval accepted';exception when others then if sqlerrm not like '%FORBIDDEN%' then raise;end if;end;
 perform pg_temp.assert_ok(true,'applicant cannot approve own payment');
 begin perform public.save_payment((select id from fixture where k='fee_app'),100,now()-interval '1 minute',(select id::text from fixture where k='fee_app'));raise exception 'reference duplicate accepted';exception when unique_violation then null;end;
 perform pg_temp.assert_ok(true,'duplicate payment reference rejected');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from fixture where k='hr'),'role','authenticated')::text,true);
select public.review_payment((select id from fixture where k='payment'),true,'');
select public.review_application((select id from fixture where k='fee_app'),'eligible');
select pg_temp.assert_ok((select status='eligible' and payment_status='confirmed' from public.applications where id=(select id from fixture where k='fee_app')),'HR-confirmed payment permits eligibility');
reset role;
select public.finish_email(id,lease_token,false,'TEST_FAILURE') from public.claim_emails(1);
select pg_temp.assert_ok((select status='eligible' from public.applications where id=(select id from fixture where k='app_a')),'email failure does not undo application');
select jsonb_agg(jsonb_build_object('test',label,'passed',passed)) as test_results from checks;
rollback;
