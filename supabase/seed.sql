-- OPTIONAL local/test data only. Do not run on production.
insert into public.departments(name) values ('หน่วยงานทดสอบ — ไม่ใช่ประกาศจริง') on conflict(name) do nothing;
insert into public.recruitment_rounds(name,year_be,opens_at,closes_at,published,max_per_user)
values('รอบทดสอบ — ไม่ใช่ประกาศจริง',2569,now()-interval '1 day',now()+interval '30 days',true,2);
insert into public.job_positions(round_id,department_id,title,category,employment_type,vacancies,qualifications,published)
select r.id,d.id,'เจ้าหน้าที่ตัวอย่าง — ข้อมูลทดสอบ','support','ประเภทการจ้างทดสอบ',1,'ข้อมูลสมมุติสำหรับทดสอบระบบเท่านั้น',true
from public.recruitment_rounds r cross join public.departments d where r.name='รอบทดสอบ — ไม่ใช่ประกาศจริง' and d.name='หน่วยงานทดสอบ — ไม่ใช่ประกาศจริง';
