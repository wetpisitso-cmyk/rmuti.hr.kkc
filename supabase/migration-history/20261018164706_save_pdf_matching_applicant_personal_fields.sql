-- Applied to production previously: 20261018164706 save_pdf_matching_applicant_personal_fields
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
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
 select * into v_job from public.job_positions where id=p_job;
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
 insert into public.application_education(application_id,degree,major,institution,graduation_year,gpa)
 select v_id,left(x->>'degree',200),left(x->>'major',200),left(x->>'institution',300),nullif(x->>'graduation_year','')::int,nullif(x->>'gpa','')::numeric
 from jsonb_array_elements(p_education) x;
 delete from public.application_experience where application_id=v_id;
 insert into public.application_experience(application_id,employer,position,details,start_date,end_date)
 select v_id,left(x->>'employer',300),left(x->>'position',200),left(coalesce(x->>'details',''),2000),nullif(x->>'start_date','')::date,nullif(x->>'end_date','')::date
 from jsonb_array_elements(p_experience) x;
 return v_id;
end $function$
;
