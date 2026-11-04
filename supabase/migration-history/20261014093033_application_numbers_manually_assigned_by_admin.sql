-- Applied to production previously: 20261014093033 application_numbers_manually_assigned_by_admin
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
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
 if not exists(select 1 from public.application_education where application_id=a.id and degree<>'' and major<>'' and institution<>'') then raise exception 'EDUCATION_REQUIRED'; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION private.review_application(p_id uuid, p_status application_state, p_message text, p_deadline timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.applications;
begin
 select * into a from public.applications where id=p_id for update;
 if a.id is null then raise exception 'NOT_FOUND'; end if;
 if p_status='withdrawn' and a.user_id=auth.uid() then
  if a.status not in ('draft','submitted','under_review','needs_correction') then raise exception 'INVALID_TRANSITION'; end if;
 else
  if not private.can('review') then raise exception 'FORBIDDEN'; end if;
  if not ((a.status='submitted' and p_status='under_review') or (a.status='under_review' and p_status in ('needs_correction','eligible','ineligible')))
  then raise exception 'INVALID_TRANSITION'; end if;
  if p_status in ('needs_correction','ineligible') and coalesce(trim(p_message),'')='' then raise exception 'REASON_REQUIRED'; end if;
  if p_status='needs_correction' and (p_deadline is null or p_deadline<=now()) then raise exception 'DEADLINE_REQUIRED'; end if;
  if p_status='eligible' and a.application_number is null then raise exception 'APPLICATION_NUMBER_REQUIRED'; end if;
  if p_status='eligible' and a.payment_status not in ('not_required','confirmed') then raise exception 'PAYMENT_REQUIRED'; end if;
 end if;
 update public.applications set status=p_status,public_message=left(coalesce(p_message,''),2000),
 correction_deadline=case when p_status='needs_correction' then p_deadline end,updated_at=clock_timestamp() where id=p_id;
end $function$
;

create or replace function public.admin_assign_application_number(p_id uuid,p_number text)
returns text language plpgsql security definer set search_path to ''
as $$
declare v_row public.applications; v_year integer; v_number text;
begin
 if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then raise exception 'FORBIDDEN'; end if;
 select * into v_row from public.applications where id=p_id for update;
 if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
 if v_row.status not in ('submitted','under_review','needs_correction') then raise exception 'APPLICATION_NOT_READY'; end if;
 if v_row.application_number is not null then raise exception 'APPLICATION_NUMBER_ALREADY_ASSIGNED'; end if;
 select r.year_be into v_year from public.job_positions j join public.recruitment_rounds r on r.id=j.round_id where j.id=v_row.job_id;
 v_number=upper(btrim(coalesce(p_number,'')));
 if v_year is null or v_number !~ '^KKC-[0-9]{4}-[0-9]{6,}$' or split_part(v_number,'-',2)::integer <> v_year then raise exception 'INVALID_APPLICATION_NUMBER'; end if;
 if exists(select 1 from public.applications where application_number=v_number) then raise exception 'DUPLICATE_APPLICATION_NUMBER'; end if;
 update public.applications set application_number=v_number,updated_at=clock_timestamp() where id=p_id;
 insert into public.audit_logs(actor_id,entity,entity_id,action,metadata) values(auth.uid(),'applications',p_id,'assign_application_number',jsonb_build_object('application_number',v_number));
 perform private.notify(v_row.user_id,p_id,'ได้รับเลขผู้สมัครแล้ว','เจ้าหน้าที่ได้กำหนดเลขผู้สมัคร '||v_number||' กรุณาเข้าสู่ระบบเพื่อตรวจสอบสถานะ','application-number:'||p_id::text);
 return v_number;
end;
$$;
revoke all on function public.admin_assign_application_number(uuid,text) from public,anon;
grant execute on function public.admin_assign_application_number(uuid,text) to authenticated;
