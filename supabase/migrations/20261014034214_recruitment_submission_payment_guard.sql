create or replace function private.submit_application(p_id uuid,p_consent text) returns text language plpgsql security definer set search_path='' as $$
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
 if a.application_number is null then
  insert into private.year_counters(year_be,last_value) values(r.year_be,1) on conflict(year_be) do update set last_value=private.year_counters.last_value+1 returning last_value into n;
  a.application_number='KKC-'||r.year_be||'-'||lpad(n::text,greatest(6,length(n::text)),'0');
 end if;
 update public.applications set application_number=a.application_number,status='submitted',payment_status=case when j.fee_amount=0 then 'not_required'::public.payment_state when a.payment_status='not_required' then 'awaiting_payment'::public.payment_state else a.payment_status end,consent_version=p_consent,consent_at=clock_timestamp(),
 submitted_at=coalesce(a.submitted_at,clock_timestamp()),updated_at=clock_timestamp(),public_message='',
 snapshot=jsonb_build_object('personal',a.personal_data,'email',v_email,'job',to_jsonb(j),'round',to_jsonb(r),
 'education',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_education e where application_id=a.id),'[]'),
 'experience',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_experience e where application_id=a.id),'[]'),
 'documents',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_documents e where application_id=a.id),'[]')) where id=a.id;
 return a.application_number;
end $$;
