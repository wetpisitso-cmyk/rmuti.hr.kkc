-- Applied to production previously: 20261018165347 add_recruitment_round_description
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
-- Optional recruitment-round description, displayed in public job details.
ALTER TABLE public.recruitment_rounds ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION private.admin_save(p_table text, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()); v_perm text; a public.applications;
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
end $function$
;

