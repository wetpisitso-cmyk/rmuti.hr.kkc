-- Opt-in only. Existing positions retain the legacy education workflow.
alter table public.job_positions add column required_education_levels text[] not null default '{}'::text[];
alter table public.job_positions add constraint job_required_education_levels_check check (
 cardinality(required_education_levels)<=3 and array_position(required_education_levels,null) is null
 and required_education_levels <@ ARRAY['มัธยมศึกษาตอนปลาย','ปวช.','ปวส.','ปริญญาตรี','ปริญญาโท','ปริญญาเอก']
 and (cardinality(required_education_levels)<2 or required_education_levels[1]<>required_education_levels[2])
 and (cardinality(required_education_levels)<3 or (required_education_levels[1]<>required_education_levels[3] and required_education_levels[2]<>required_education_levels[3]))
);
alter table public.application_education add column education_level text;
alter table public.application_education add constraint application_education_level_check check (education_level is null or education_level=any(ARRAY['มัธยมศึกษาตอนปลาย','ปวช.','ปวส.','ปริญญาตรี','ปริญญาโท','ปริญญาเอก']));

CREATE OR REPLACE FUNCTION private.admin_save(p_table text, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()); v_perm text; a public.applications; v_levels text[]; v_old_levels text[];
begin
 v_perm=case when p_table in ('departments','recruitment_rounds','job_positions') then 'manage_jobs' when p_table='announcements' then 'publish' else 'exams' end;
 if not private.can(v_perm) then raise exception 'FORBIDDEN'; end if;
 case p_table
 when 'departments' then
  insert into public.departments(id,name,archived) values(v_id,p_data->>'name',coalesce((p_data->>'archived')::boolean,false))
  on conflict(id) do update set name=excluded.name,archived=excluded.archived;
 when 'recruitment_rounds' then
  if length(coalesce(p_data->>'description',''))>4000 then raise exception 'DESCRIPTION_TOO_LONG'; end if;
  insert into public.recruitment_rounds(id,name,year_be,opens_at,closes_at,max_per_user,published,archived,description)
  values(v_id,p_data->>'name',(p_data->>'year_be')::int,(p_data->>'opens_at')::timestamptz,(p_data->>'closes_at')::timestamptz,
  coalesce((p_data->>'max_per_user')::int,1),coalesce((p_data->>'published')::boolean,false),coalesce((p_data->>'archived')::boolean,false),
  coalesce(p_data->>'description',''))
  on conflict(id) do update set name=excluded.name,year_be=excluded.year_be,opens_at=excluded.opens_at,closes_at=excluded.closes_at,max_per_user=excluded.max_per_user,published=excluded.published,archived=excluded.archived,description=excluded.description;
 when 'job_positions' then
  -- Serialize against new applications using the same position row lock.
  select required_education_levels into v_old_levels from public.job_positions where id=v_id for update;
  v_old_levels=coalesce(v_old_levels,'{}'::text[]);
  if p_data ? 'required_education_levels' then
   if jsonb_typeof(p_data->'required_education_levels') is distinct from 'array' then raise exception 'INVALID_EDUCATION_CONFIG'; end if;
   select coalesce(array_agg(value order by ord), '{}'::text[]) into v_levels from jsonb_array_elements_text(p_data->'required_education_levels') with ordinality t(value,ord);
  else v_levels=v_old_levels; end if;
  if cardinality(v_levels)>3 or array_position(v_levels,null) is not null or not (v_levels <@ ARRAY['มัธยมศึกษาตอนปลาย','ปวช.','ปวส.','ปริญญาตรี','ปริญญาโท','ปริญญาเอก']) or cardinality(v_levels)<>(select count(distinct x) from unnest(v_levels) x) then raise exception 'INVALID_EDUCATION_CONFIG'; end if;
  if v_levels is distinct from v_old_levels and exists(select 1 from public.applications where job_id=v_id) then raise exception 'EDUCATION_CONFIG_LOCKED'; end if;
  if cardinality(v_levels)>0 then
   -- Canonical document keys and labels are generated server-side too.
   p_data=jsonb_set(p_data,'{required_documents}',coalesce((select jsonb_agg(d) from jsonb_array_elements(p_data->'required_documents') d where (d->>'key') !~ '^(degree|transcript)(_[123])?  if exists(select 1 from public.applications where job_id=v_id and submitted_at is not null) and exists(select 1 from public.job_positions where id=v_id and (round_id<>(p_data->>'round_id')::uuid or fee_amount<>coalesce((p_data->>'fee_amount')::numeric,0))) then raise exception 'POSITION_LOCKED'; end if;
  if exists(select 1 from jsonb_array_elements(p_data->'required_documents') d where coalesce(d->>'key','')!~ '^[a-z][a-z0-9_]{0,39}$' or coalesce(d->>'label','')='')
   or (select count(*) from jsonb_array_elements(p_data->'required_documents'))<>(select count(distinct d->>'key') from jsonb_array_elements(p_data->'required_documents') d) then raise exception 'INVALID_DOCUMENT_TYPE'; end if;
  insert into public.job_positions(id,round_id,department_id,title,category,employment_type,vacancies,qualifications,required_education_levels,required_documents,require_national_id,fee_amount,payment_instructions,announcement_url,max_file_mb,published,archived)
  values(v_id,(p_data->>'round_id')::uuid,(p_data->>'department_id')::uuid,p_data->>'title',p_data->>'category',p_data->>'employment_type',(p_data->>'vacancies')::int,
  coalesce(p_data->>'qualifications',''),v_levels,p_data->'required_documents',coalesce((p_data->>'require_national_id')::boolean,false),coalesce((p_data->>'fee_amount')::numeric,0),
  coalesce(p_data->>'payment_instructions',''),coalesce(p_data->>'announcement_url',''),coalesce((p_data->>'max_file_mb')::int,10),coalesce((p_data->>'published')::boolean,false),coalesce((p_data->>'archived')::boolean,false))
  on conflict(id) do update set round_id=excluded.round_id,department_id=excluded.department_id,title=excluded.title,category=excluded.category,employment_type=excluded.employment_type,vacancies=excluded.vacancies,
  qualifications=excluded.qualifications,required_education_levels=excluded.required_education_levels,required_documents=excluded.required_documents,require_national_id=excluded.require_national_id,fee_amount=excluded.fee_amount,payment_instructions=excluded.payment_instructions,
  announcement_url=excluded.announcement_url,max_file_mb=excluded.max_file_mb,published=excluded.published,archived=excluded.archived;
 when 'announcements' then
  insert into public.announcements(id,title,content,attachment_url,published) values(v_id,p_data->>'title',coalesce(p_data->>'content',''),coalesce(p_data->>'attachment_url',''),coalesce((p_data->>'published')::boolean,false))
  on conflict(id) do update set title=excluded.title,content=excluded.content,attachment_url=excluded.attachment_url,published=excluded.published;
 when 'exam_schedules' then
  insert into public.exam_schedules(id,job_id,title,exam_at,venue,instructions,published) values(v_id,(p_data->>'job_id')::uuid,p_data->>'title',(p_data->>'exam_at')::timestamptz,p_data->>'venue',coalesce(p_data->>'instructions',''),coalesce((p_data->>'published')::boolean,false))
  on conflict(id) do update set title=excluded.title,exam_at=excluded.exam_at,venue=excluded.venue,instructions=excluded.instructions,published=excluded.published;
 when 'exam_assignments' then
  select * into a from public.applications where id=(p_data->>'application_id')::uuid;
  if a.status<>'eligible' or not exists(select 1 from public.exam_schedules where id=(p_data->>'schedule_id')::uuid and job_id=a.job_id) then raise exception 'INVALID_EXAM_ASSIGNMENT'; end if;
  insert into public.exam_assignments(id,application_id,schedule_id,exam_number) values(v_id,a.id,(p_data->>'schedule_id')::uuid,p_data->>'exam_number')
  on conflict(application_id,schedule_id) do update set exam_number=excluded.exam_number returning id into v_id;
 when 'selection_results' then
  select * into a from public.applications where id=(p_data->>'application_id')::uuid;
  if a.status<>'eligible' then raise exception 'INVALID_TRANSITION'; end if;
  insert into public.selection_results(id,application_id,score,outcome,remark,updated_by) values(v_id,a.id,nullif(p_data->>'score','')::numeric,p_data->>'outcome',coalesce(p_data->>'remark',''),auth.uid())
  on conflict(application_id) do update set score=excluded.score,outcome=excluded.outcome,remark=excluded.remark,published=false,updated_by=auth.uid(),updated_at=now() returning id into v_id;
 else raise exception 'INVALID_TABLE';
 end case;
 insert into public.audit_logs(actor_id,entity,entity_id,action) values(auth.uid(),p_table,v_id,'save');
 return v_id;
end $function$
),'[]'::jsonb) ||
    (select jsonb_agg(jsonb_build_object('key',k.key || case when i=1 then '' else '_' || i::text end,'label',k.label || ' — ' || l,'required',true) order by i,k.key)
     from unnest(v_levels) with ordinality t(l,i) cross join (values ('degree','หลักฐานคุณวุฒิ'),('transcript','ใบรายงานผลการศึกษา')) k(key,label)));
  end if;
  if exists(select 1 from public.applications where job_id=v_id and submitted_at is not null) and exists(select 1 from public.job_positions where id=v_id and (round_id<>(p_data->>'round_id')::uuid or fee_amount<>coalesce((p_data->>'fee_amount')::numeric,0))) then raise exception 'POSITION_LOCKED'; end if;
  if exists(select 1 from jsonb_array_elements(p_data->'required_documents') d where coalesce(d->>'key','')!~ '^[a-z][a-z0-9_]{0,39}$' or coalesce(d->>'label','')='')
   or (select count(*) from jsonb_array_elements(p_data->'required_documents'))<>(select count(distinct d->>'key') from jsonb_array_elements(p_data->'required_documents') d) then raise exception 'INVALID_DOCUMENT_TYPE'; end if;
  insert into public.job_positions(id,round_id,department_id,title,category,employment_type,vacancies,qualifications,required_documents,require_national_id,fee_amount,payment_instructions,announcement_url,max_file_mb,published,archived)
  values(v_id,(p_data->>'round_id')::uuid,(p_data->>'department_id')::uuid,p_data->>'title',p_data->>'category',p_data->>'employment_type',(p_data->>'vacancies')::int,
  coalesce(p_data->>'qualifications',''),p_data->'required_documents',coalesce((p_data->>'require_national_id')::boolean,false),coalesce((p_data->>'fee_amount')::numeric,0),
  coalesce(p_data->>'payment_instructions',''),coalesce(p_data->>'announcement_url',''),coalesce((p_data->>'max_file_mb')::int,10),coalesce((p_data->>'published')::boolean,false),coalesce((p_data->>'archived')::boolean,false))
  on conflict(id) do update set round_id=excluded.round_id,department_id=excluded.department_id,title=excluded.title,category=excluded.category,employment_type=excluded.employment_type,vacancies=excluded.vacancies,
  qualifications=excluded.qualifications,required_documents=excluded.required_documents,require_national_id=excluded.require_national_id,fee_amount=excluded.fee_amount,payment_instructions=excluded.payment_instructions,
  announcement_url=excluded.announcement_url,max_file_mb=excluded.max_file_mb,published=excluded.published,archived=excluded.archived;
 when 'announcements' then
  insert into public.announcements(id,title,content,attachment_url,published) values(v_id,p_data->>'title',coalesce(p_data->>'content',''),coalesce(p_data->>'attachment_url',''),coalesce((p_data->>'published')::boolean,false))
  on conflict(id) do update set title=excluded.title,content=excluded.content,attachment_url=excluded.attachment_url,published=excluded.published;
 when 'exam_schedules' then
  insert into public.exam_schedules(id,job_id,title,exam_at,venue,instructions,published) values(v_id,(p_data->>'job_id')::uuid,p_data->>'title',(p_data->>'exam_at')::timestamptz,p_data->>'venue',coalesce(p_data->>'instructions',''),coalesce((p_data->>'published')::boolean,false))
  on conflict(id) do update set title=excluded.title,exam_at=excluded.exam_at,venue=excluded.venue,instructions=excluded.instructions,published=excluded.published;
 when 'exam_assignments' then
  select * into a from public.applications where id=(p_data->>'application_id')::uuid;
  if a.status<>'eligible' or not exists(select 1 from public.exam_schedules where id=(p_data->>'schedule_id')::uuid and job_id=a.job_id) then raise exception 'INVALID_EXAM_ASSIGNMENT'; end if;
  insert into public.exam_assignments(id,application_id,schedule_id,exam_number) values(v_id,a.id,(p_data->>'schedule_id')::uuid,p_data->>'exam_number')
  on conflict(application_id,schedule_id) do update set exam_number=excluded.exam_number returning id into v_id;
 when 'selection_results' then
  select * into a from public.applications where id=(p_data->>'application_id')::uuid;
  if a.status<>'eligible' then raise exception 'INVALID_TRANSITION'; end if;
  insert into public.selection_results(id,application_id,score,outcome,remark,updated_by) values(v_id,a.id,nullif(p_data->>'score','')::numeric,p_data->>'outcome',coalesce(p_data->>'remark',''),auth.uid())
  on conflict(application_id) do update set score=excluded.score,outcome=excluded.outcome,remark=excluded.remark,published=false,updated_by=auth.uid(),updated_at=now() returning id into v_id;
 else raise exception 'INVALID_TABLE';
 end case;
 insert into public.audit_logs(actor_id,entity,entity_id,action) values(auth.uid(),p_table,v_id,'save');
 return v_id;
end $function$;

CREATE OR REPLACE FUNCTION private.save_application(p_id uuid, p_job uuid, p_personal jsonb, p_education jsonb, p_experience jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_job public.job_positions; v_round public.recruitment_rounds; v_data jsonb;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 if jsonb_typeof(p_personal)<>'object' or jsonb_typeof(p_education)<>'array' or jsonb_typeof(p_experience)<>'array'
 or jsonb_array_length(p_education)>20 or jsonb_array_length(p_experience)>30 or length(p_personal::text)>20000 then raise exception 'INVALID_INPUT'; end if;
 select * into v_job from public.job_positions where id=p_job for share;
 select * into v_round from public.recruitment_rounds where id=v_job.round_id;
 if v_job.id is null then raise exception 'POSITION_NOT_FOUND'; end if;
 v_data=jsonb_build_object('prefix',left(coalesce(p_personal->>'prefix',''),30),'first_name',left(coalesce(p_personal->>'first_name',''),100),
 'last_name',left(coalesce(p_personal->>'last_name',''),100),'birth_date',p_personal->>'birth_date',
 'phone',left(coalesce(p_personal->>'phone',''),20),'address',left(coalesce(p_personal->>'address',''),2000),
 'national_id',case when v_job.require_national_id then p_personal->>'national_id' else null end,
 'english_name',left(coalesce(p_personal->>'english_name',''),200),
 'gender',left(coalesce(p_personal->>'gender',''),30),
 'nationality',left(coalesce(p_personal->>'nationality',''),100),
 'ethnicity',left(coalesce(p_personal->>'ethnicity',''),100),
 'religion',left(coalesce(p_personal->>'religion',''),100),
 'marital_status',left(coalesce(p_personal->>'marital_status',''),50),
 'line_id',left(coalesce(p_personal->>'line_id',''),100),
 'registered_address',left(coalesce(p_personal->>'registered_address',''),2000),
 'military_status',left(coalesce(p_personal->>'military_status',''),200),
 'skills',left(coalesce(p_personal->>'skills',''),2000));
 if p_id is null then
  if not v_round.published or not v_job.published or v_job.archived or v_round.archived or now()<v_round.opens_at or now()>v_round.closes_at then raise exception 'ROUND_CLOSED'; end if;
  insert into public.applications(user_id,job_id,personal_data,payment_status) values(auth.uid(),p_job,v_data,
   case when v_job.fee_amount>0 then 'awaiting_payment'::public.payment_state else 'not_required'::public.payment_state end)
  on conflict (user_id,job_id) where archived_at is null do nothing returning id into v_id;
  if v_id is null then raise exception 'DUPLICATE_APPLICATION'; end if;
 else
  perform 1 from public.applications where id=p_id and user_id=auth.uid() and job_id=p_job and archived_at is null for update;
  if not found or not private.editable(p_id,auth.uid()) then raise exception 'APPLICATION_LOCKED'; end if;
  v_id=p_id;
  update public.applications set personal_data=v_data,updated_at=clock_timestamp() where id=v_id;
 end if;
 delete from public.application_education where application_id=v_id;
 insert into public.application_education(application_id,degree,major,institution,graduation_year,gpa,education_level)
 select v_id,left(x->>'degree',200),left(x->>'major',200),left(x->>'institution',300),nullif(x->>'graduation_year','')::int,nullif(x->>'gpa','')::numeric,case when cardinality(v_job.required_education_levels)>0 then nullif(x->>'education_level','') else null end
 from jsonb_array_elements(p_education) x;
 delete from public.application_experience where application_id=v_id;
 insert into public.application_experience(application_id,employer,position,details,start_date,end_date)
 select v_id,left(x->>'employer',300),left(x->>'position',200),left(coalesce(x->>'details',''),2000),nullif(x->>'start_date','')::date,nullif(x->>'end_date','')::date
 from jsonb_array_elements(p_experience) x;
 return v_id;
end $function$;

CREATE OR REPLACE FUNCTION private.submit_application(p_id uuid, p_consent text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.applications; j public.job_positions; r public.recruitment_rounds; n bigint; v_email text; v_sum int=0; i int; nid text;
begin
 select * into a from public.applications where id=p_id and user_id=auth.uid() for update;
 if a.id is null then raise exception 'FORBIDDEN'; end if;
 if a.status in ('submitted','under_review','eligible','ineligible') then return a.application_number; end if;
 if not private.editable(a.id,auth.uid()) then raise exception 'APPLICATION_LOCKED'; end if;
 select * into j from public.job_positions where id=a.job_id;
 -- Serializes quota checking for the entire round and concurrent submissions.
 select * into r from public.recruitment_rounds where id=j.round_id for update;
 if a.status='draft' and (select count(*) from public.applications x join public.job_positions y on y.id=x.job_id
  where x.user_id=auth.uid() and y.round_id=r.id and x.id<>a.id and x.submitted_at is not null and x.status<>'withdrawn')>=r.max_per_user then raise exception 'ROUND_QUOTA'; end if;
 if coalesce(length(a.personal_data->>'first_name'),0)=0 or coalesce(length(a.personal_data->>'last_name'),0)=0
 or coalesce(a.personal_data->>'phone','') !~ '^[0-9+ -]{9,20}$' or coalesce(length(a.personal_data->>'address'),0)=0
 or nullif(a.personal_data->>'birth_date','') is null or (a.personal_data->>'birth_date')::date>=current_date then raise exception 'INCOMPLETE_APPLICATION'; end if;
 -- Verify the five newly required identity fields on the trusted DB submission path.
 if not private.applicant_required_fields_valid(a.personal_data) then raise exception 'INCOMPLETE_APPLICATION'; end if;
 if not exists(select 1 from public.application_education where application_id=a.id and degree<>'' and major<>'' and institution<>'') then raise exception 'EDUCATION_REQUIRED'; end if;
 if cardinality(j.required_education_levels)>0 and (
   (select count(*) from public.application_education where application_id=a.id)<>cardinality(j.required_education_levels)
   or exists(select 1 from unnest(j.required_education_levels) l where not exists(
     select 1 from public.application_education e where e.application_id=a.id and e.education_level=l
       and btrim(e.degree)<>'' and btrim(e.major)<>'' and btrim(e.institution)<>'' and e.graduation_year is not null and e.gpa is not null
   ))
 ) then raise exception 'EDUCATION_LEVELS_REQUIRED'; end if;
 nid=a.personal_data->>'national_id';
 if j.require_national_id then
  if coalesce(nid,'') !~ '^[0-9]{13}$' then raise exception 'INVALID_NATIONAL_ID'; end if;
  for i in 1..12 loop v_sum=v_sum+substring(nid,i,1)::int*(14-i); end loop;
  if (11-(v_sum%11))%10<>substring(nid,13,1)::int then raise exception 'INVALID_NATIONAL_ID'; end if;
 end if;
 if exists(select 1 from jsonb_array_elements(j.required_documents) d where coalesce((d->>'required')::boolean,false)
  and not exists(select 1 from public.application_documents doc where doc.application_id=a.id and doc.document_type=d->>'key')) then raise exception 'DOCUMENTS_REQUIRED'; end if;
 if p_consent is distinct from (select value->>'version' from public.app_settings where key='privacy') then raise exception 'CONSENT_REQUIRED'; end if;
 select email into v_email from auth.users where id=auth.uid();
 update public.applications set status='submitted',payment_status=case when j.fee_amount=0 then 'not_required'::public.payment_state when a.payment_status='not_required' then 'awaiting_payment'::public.payment_state else a.payment_status end,consent_version=p_consent,consent_at=clock_timestamp(),
 submitted_at=coalesce(a.submitted_at,clock_timestamp()),updated_at=clock_timestamp(),public_message='',
 snapshot=jsonb_build_object('personal',a.personal_data,'email',v_email,'job',to_jsonb(j),'round',to_jsonb(r),
 'education',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_education e where application_id=a.id),'[]'),
 'experience',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_experience e where application_id=a.id),'[]'),
 'documents',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_documents e where application_id=a.id),'[]')) where id=a.id;
 return a.application_number;
end $function$;

