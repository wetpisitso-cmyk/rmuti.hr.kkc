-- Applied to production previously: 20261018142058 allow_reapplication_after_admin_archive
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
-- An archived application is historical and must not prevent a fresh application
-- to the same vacancy. At most ONE active application per applicant and job.
-- Archived receipt/payment records remain bound to their original ID.
create unique index if not exists applications_one_active_per_user_job
  on public.applications(user_id,job_id) where archived_at is null;
alter table public.applications drop constraint if exists applications_user_id_job_id_key;

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
 'national_id',case when v_job.require_national_id then p_personal->>'national_id' else null end);
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

-- Archived forms must never become editable again through ordinary applicant actions.
create or replace function private.editable(p_id uuid,p_user uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
 select exists (
  select 1 from public.applications a
  join public.job_positions j on j.id=a.job_id
  join public.recruitment_rounds r on r.id=j.round_id
  where a.id=p_id and a.user_id=p_user and a.archived_at is null
    and not j.archived and not r.archived
    and ((a.status='draft' and r.published and j.published and now() between r.opens_at and r.closes_at)
       or (a.status='needs_correction' and now()<=a.correction_deadline))
 );
$function$;

-- Allow the old owner to discover only the job ID from a removed/archive URL
-- to restart the application; no archived personal data is returned.
create or replace function public.applicant_archived_job(p_id uuid)
returns uuid language sql stable security definer set search_path to ''
as $function$
 select job_id from public.applications
 where id=p_id and user_id=(select auth.uid()) and archived_at is not null;
$function$;
revoke all on function public.applicant_archived_job(uuid) from public,anon;
grant execute on function public.applicant_archived_job(uuid) to authenticated;

