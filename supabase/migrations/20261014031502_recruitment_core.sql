-- Deployment source. Copy to a CLI-created migration (see README). No personal data.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create type public.app_role as enum ('applicant','hr','admin');
create type public.application_state as enum ('draft','submitted','under_review','needs_correction','eligible','ineligible','withdrawn');
create type public.payment_state as enum ('not_required','awaiting_payment','pending','confirmed','rejected');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 prefix text not null default '', first_name text not null default '', last_name text not null default '',
 phone text not null default '', consent_version text not null default '', consent_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role public.app_role not null default 'applicant', permissions text[] not null default '{}',
 granted_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table public.departments (id uuid primary key default gen_random_uuid(), name text not null unique, archived boolean not null default false);
create table public.recruitment_rounds (
 id uuid primary key default gen_random_uuid(), name text not null, year_be int not null check(year_be between 2500 and 2800),
 opens_at timestamptz not null, closes_at timestamptz not null, max_per_user int not null default 1 check(max_per_user between 1 and 20),
 published boolean not null default false, archived boolean not null default false, check(closes_at>opens_at)
);
create table public.job_positions (
 id uuid primary key default gen_random_uuid(), round_id uuid not null references public.recruitment_rounds(id),
 department_id uuid not null references public.departments(id), title text not null, category text not null check(category in ('academic','support')),
 employment_type text not null, vacancies int not null check(vacancies>0), qualifications text not null default '',
 required_documents jsonb not null default '[{"key":"photo","label":"รูปติดใบสมัคร","required":true},{"key":"degree","label":"หลักฐานวุฒิการศึกษา","required":true},{"key":"transcript","label":"Transcript","required":true}]',
 require_national_id boolean not null default false, fee_amount numeric(12,2) not null default 0 check(fee_amount>=0),
 payment_instructions text not null default '', announcement_url text not null default '',
 max_file_mb int not null default 10 check(max_file_mb between 1 and 10),
 published boolean not null default false, archived boolean not null default false,
 check(jsonb_typeof(required_documents)='array')
);
create table public.applications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 job_id uuid not null references public.job_positions(id), status public.application_state not null default 'draft',
 personal_data jsonb not null default '{}', snapshot jsonb, application_number text unique,
 consent_version text, consent_at timestamptz, submitted_at timestamptz, correction_deadline timestamptz,
 public_message text not null default '', payment_status public.payment_state not null default 'not_required',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,job_id), check(jsonb_typeof(personal_data)='object')
);
create table public.application_education (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id) on delete cascade,
 degree text not null, major text not null, institution text not null, graduation_year int check(graduation_year between 2400 and 2800),
 gpa numeric(4,2) check(gpa between 0 and 4)
);
create table public.application_experience (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id) on delete cascade,
 employer text not null, position text not null, details text not null default '', start_date date, end_date date,
 check(end_date is null or start_date is null or end_date>=start_date)
);
create table public.application_documents (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id),
 document_type text not null, storage_path text not null unique, file_name text not null, mime_type text not null,
 size_bytes int not null check(size_bytes between 1 and 10485760), uploaded_at timestamptz not null default now(),
 unique(application_id,document_type), check(mime_type in ('application/pdf','image/jpeg','image/png'))
);
create table public.payment_records (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id),
 document_id uuid not null references public.application_documents(id), slip_path text not null, amount numeric(12,2) not null check(amount>0),
 paid_at timestamptz not null, reference text, status public.payment_state not null default 'pending', reason text not null default '',
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
 check(status in ('pending','confirmed','rejected'))
);
create unique index payment_reference_unique on public.payment_records(lower(reference)) where reference is not null and reference<>'';
create table public.application_status_history (
 id bigint generated always as identity primary key, application_id uuid not null references public.applications(id),
 from_status public.application_state, to_status public.application_state not null, message text not null default '',
 actor_id uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.application_document_versions (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id),
 document_type text not null, storage_path text not null unique, file_name text not null, uploaded_at timestamptz not null default now()
);
create table public.staff_notes (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id),
 author_id uuid not null references auth.users(id), note text not null, created_at timestamptz not null default now()
);
create table public.exam_schedules (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.job_positions(id),
 title text not null, exam_at timestamptz not null, venue text not null, instructions text not null default '',
 published boolean not null default false
);
create table public.exam_assignments (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id),
 schedule_id uuid not null references public.exam_schedules(id), exam_number text not null,
 unique(schedule_id,exam_number), unique(application_id,schedule_id)
);
create table public.selection_results (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id) unique,
 score numeric(6,2) check(score between 0 and 100), outcome text not null check(outcome in ('selected','reserve','not_selected','eligible','ineligible')),
 remark text not null default '', published boolean not null default false, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table public.announcements (
 id uuid primary key default gen_random_uuid(), title text not null, content text not null default '',
 attachment_url text not null default '', published boolean not null default false, created_at timestamptz not null default now()
);
create table public.published_results (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.job_positions(id),
 title text not null, kind text not null check(kind in ('eligibility','selection')), rows jsonb not null default '[]',
 approved_by uuid not null references auth.users(id), published_at timestamptz not null default now(), unique(job_id,kind)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 application_id uuid references public.applications(id), title text not null, message text not null, read_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.email_outbox (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 subject text not null, body text not null, dedup_key text not null unique,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts int not null default 0, next_attempt_at timestamptz not null default now(), lease_until timestamptz,
 lease_token uuid, sent_at timestamptz, error_code text, created_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
 entity text not null, entity_id uuid, action text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table private.year_counters (year_be int primary key, last_value bigint not null default 0);
create table private.rate_limits (scope text not null, user_key text not null, bucket timestamptz not null, hits int not null, primary key(scope,user_key,bucket));
alter table private.year_counters enable row level security;
alter table private.rate_limits enable row level security;

create index applications_owner on public.applications(user_id,updated_at desc);
create index applications_job_status on public.applications(job_id,status,submitted_at desc);
create index jobs_round on public.job_positions(round_id);
create index jobs_department on public.job_positions(department_id);
create index education_app on public.application_education(application_id);
create index experience_app on public.application_experience(application_id);
create index payments_app on public.payment_records(application_id,created_at desc);
create index history_app on public.application_status_history(application_id,created_at);
create index document_versions_app on public.application_document_versions(application_id);
create index notes_app on public.staff_notes(application_id);
create index notes_author on public.staff_notes(author_id);
create index exam_job on public.exam_schedules(job_id);
create index assignments_schedule on public.exam_assignments(schedule_id);
create index notifications_owner on public.notifications(user_id,created_at desc);
create index outbox_due on public.email_outbox(status,next_attempt_at) where status in ('pending','processing');
create index outbox_owner on public.email_outbox(user_id);
create index audit_time on public.audit_logs(created_at desc);

create function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('hr','admin'));
$$;
create function private.can(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.user_roles where user_id=auth.uid() and (role='admin' or (role='hr' and p_permission=any(permissions))));
$$;
create function private.owns(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.applications where id=p_id and user_id=auth.uid());
$$;
create function private.editable(p_id uuid, p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.applications a join public.job_positions j on j.id=a.job_id join public.recruitment_rounds r on r.id=j.round_id
 where a.id=p_id and a.user_id=p_user and not j.archived and not r.archived and
 ((a.status='draft' and r.published and j.published and now() between r.opens_at and r.closes_at)
 or (a.status='needs_correction' and now()<=a.correction_deadline)));
$$;
create function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_user_meta_data->>'consent_version' is distinct from (select value->>'version' from public.app_settings where key='privacy') then raise exception 'CONSENT_REQUIRED'; end if;
 insert into public.profiles(id,prefix,first_name,last_name,phone,consent_version,consent_at)
 values(new.id, left(coalesce(new.raw_user_meta_data->>'prefix',''),30),left(coalesce(new.raw_user_meta_data->>'first_name',''),100),
 left(coalesce(new.raw_user_meta_data->>'last_name',''),100),left(coalesce(new.raw_user_meta_data->>'phone',''),20),
 left(coalesce(new.raw_user_meta_data->>'consent_version',''),50),case when new.raw_user_meta_data->>'consent_version' is not null then now() end);
 insert into public.user_roles(user_id,role) values(new.id,'applicant');
 return new;
end $$;
create trigger recruitment_signup after insert on auth.users for each row execute function private.on_signup();

create function private.notify(p_user uuid,p_app uuid,p_title text,p_message text,p_key text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(user_id,application_id,title,message) values(p_user,p_app,p_title,p_message);
 insert into public.email_outbox(user_id,subject,body,dedup_key) values(p_user,p_title,p_message,p_key) on conflict(dedup_key) do nothing;
end $$;
create function private.state_log() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.status is distinct from old.status then
  insert into public.application_status_history(application_id,from_status,to_status,message,actor_id)
  values(new.id,case when tg_op='UPDATE' then old.status end,new.status,new.public_message,auth.uid());
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'application',new.id,'status',jsonb_build_object('status',new.status));
  if new.status<>'draft' then
   perform private.notify(new.user_id,new.id,'อัปเดตใบสมัคร '||coalesce(new.application_number,''),
    'สถานะ: '||new.status||case when new.public_message<>'' then E'\n'||new.public_message else '' end,new.id||':'||new.status||':'||new.updated_at);
  end if;
 end if;
 return new;
end $$;
create trigger application_state_log after insert or update on public.applications for each row execute function private.state_log();

-- Only guarded RPCs mutate protected application columns.
create function private.save_application(p_id uuid,p_job uuid,p_personal jsonb,p_education jsonb,p_experience jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
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
  on conflict(user_id,job_id) do nothing returning id into v_id;
  if v_id is null then raise exception 'DUPLICATE_APPLICATION'; end if;
 else
  perform 1 from public.applications where id=p_id and user_id=auth.uid() and job_id=p_job for update;
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
end $$;
create function public.save_application(p_id uuid,p_job uuid,p_personal jsonb,p_education jsonb,p_experience jsonb) returns uuid language sql set search_path='' as $$
 select private.save_application(p_id,p_job,p_personal,p_education,p_experience);
$$;

create function private.submit_application(p_id uuid,p_consent text) returns text language plpgsql security definer set search_path='' as $$
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
 update public.applications set application_number=a.application_number,status='submitted',consent_version=p_consent,consent_at=clock_timestamp(),
 submitted_at=coalesce(a.submitted_at,clock_timestamp()),updated_at=clock_timestamp(),public_message='',
 snapshot=jsonb_build_object('personal',a.personal_data,'email',v_email,'job',to_jsonb(j),'round',to_jsonb(r),
 'education',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_education e where application_id=a.id),'[]'),
 'experience',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_experience e where application_id=a.id),'[]'),
 'documents',coalesce((select jsonb_agg(to_jsonb(e)-'application_id') from public.application_documents e where application_id=a.id),'[]')) where id=a.id;
 return a.application_number;
end $$;
create function public.submit_application(p_id uuid,p_consent text) returns text language sql set search_path='' as $$select private.submit_application(p_id,p_consent);$$;

create function private.review_application(p_id uuid,p_status public.application_state,p_message text,p_deadline timestamptz) returns void
language plpgsql security definer set search_path='' as $$
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
  if p_status='eligible' and a.payment_status not in ('not_required','confirmed') then raise exception 'PAYMENT_REQUIRED'; end if;
 end if;
 update public.applications set status=p_status,public_message=left(coalesce(p_message,''),2000),
 correction_deadline=case when p_status='needs_correction' then p_deadline end,updated_at=clock_timestamp() where id=p_id;
end $$;
create function public.review_application(p_id uuid,p_status public.application_state,p_message text default '',p_deadline timestamptz default null) returns void
language sql set search_path='' as $$select private.review_application(p_id,p_status,p_message,p_deadline);$$;

create function private.check_upload(p_id uuid,p_type text,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications; j public.job_positions;
begin
 select * into a from public.applications where id=p_id and user_id=p_user;
 select * into j from public.job_positions where id=a.job_id;
 if a.id is null then raise exception 'FORBIDDEN'; end if;
 if p_type='payment' then
  if j.fee_amount<=0 or a.payment_status='confirmed' or a.status in ('ineligible','withdrawn') then raise exception 'PAYMENT_LOCKED'; end if;
 else
  if not private.editable(a.id,p_user) then raise exception 'APPLICATION_LOCKED'; end if;
  if not exists(select 1 from jsonb_array_elements(j.required_documents) x where x->>'key'=p_type) then raise exception 'INVALID_DOCUMENT_TYPE'; end if;
 end if;
 return jsonb_build_object('max_bytes',j.max_file_mb*1048576);
end $$;
create function public.check_upload(p_id uuid,p_type text) returns jsonb language sql set search_path='' as $$select private.check_upload(p_id,p_type,auth.uid());$$;
-- Called ONLY by the authenticated upload Edge Function with the service key.
create function public.complete_upload(p_user uuid,p_id uuid,p_type text,p_path text,p_name text,p_mime text,p_size int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_old text; v_doc uuid; v_limits jsonb;
begin
 perform 1 from public.applications where id=p_id for update;
 v_limits=private.check_upload(p_id,p_type,p_user);
 if p_size<=0 or p_size>(v_limits->>'max_bytes')::int or p_path not like p_user||'/'||p_id||'/%'
 or p_mime not in ('application/pdf','image/jpeg','image/png') or (p_type='photo' and p_mime='application/pdf') then raise exception 'INVALID_FILE'; end if;
 if not exists(select 1 from storage.objects where bucket_id='application-files' and name=p_path) then raise exception 'FILE_NOT_FOUND'; end if;
 select storage_path into v_old from public.application_documents where application_id=p_id and document_type=p_type;
 if v_old is not null then
  insert into public.application_document_versions(application_id,document_type,storage_path,file_name)
  select application_id,document_type,storage_path,file_name from public.application_documents where application_id=p_id and document_type=p_type
  on conflict(storage_path) do nothing;
 end if;
 insert into public.application_documents(application_id,document_type,storage_path,file_name,mime_type,size_bytes)
 values(p_id,p_type,p_path,left(p_name,250),p_mime,p_size)
 on conflict(application_id,document_type) do update set storage_path=excluded.storage_path,file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,uploaded_at=now()
 returning id into v_doc;
 return jsonb_build_object('document_id',v_doc,'old_path',v_old);
end $$;
create function private.save_payment(p_app uuid,p_amount numeric,p_paid timestamptz,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.applications; j public.job_positions; d uuid; v_id uuid; v_ref text;
begin
 select * into a from public.applications where id=p_app and user_id=auth.uid() for update;
 if a.id is null then raise exception 'FORBIDDEN'; end if;
 select * into j from public.job_positions where id=a.job_id;
 if j.fee_amount<=0 or a.payment_status='confirmed' or a.status in ('ineligible','withdrawn') then raise exception 'PAYMENT_LOCKED'; end if;
 if p_amount<>j.fee_amount or p_paid is null or p_paid>now() or p_paid<now()-interval '1 year' then raise exception 'INVALID_PAYMENT'; end if;
 select id into d from public.application_documents where application_id=a.id and document_type='payment';
 if d is null then raise exception 'DOCUMENTS_REQUIRED'; end if;
 v_ref=nullif(trim(left(p_reference,100)),'');
 insert into public.payment_records(application_id,document_id,slip_path,amount,paid_at,reference)
 values(a.id,d,(select storage_path from public.application_documents where id=d),p_amount,p_paid,v_ref) returning id into v_id;
 update public.applications set payment_status='pending',updated_at=clock_timestamp() where id=a.id;
 return v_id;
end $$;
create function public.save_payment(p_app uuid,p_amount numeric,p_paid timestamptz,p_reference text default '') returns uuid language sql set search_path='' as $$select private.save_payment(p_app,p_amount,p_paid,p_reference);$$;
create function private.review_payment(p_id uuid,p_confirm boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare p public.payment_records;
begin
 if not private.can('payments') then raise exception 'FORBIDDEN'; end if;
 select * into p from public.payment_records where id=p_id for update;
 if p.id is null or p.status<>'pending' then raise exception 'PAYMENT_LOCKED'; end if;
 if not p_confirm and coalesce(trim(p_reason),'')='' then raise exception 'REASON_REQUIRED'; end if;
 if exists(select 1 from public.payment_records where application_id=p.application_id and created_at>p.created_at) then raise exception 'STALE_PAYMENT'; end if;
 update public.payment_records set status=case when p_confirm then 'confirmed'::public.payment_state else 'rejected'::public.payment_state end,
 reason=left(coalesce(p_reason,''),2000),reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
 update public.applications set payment_status=case when p_confirm then 'confirmed'::public.payment_state else 'rejected'::public.payment_state end where id=p.application_id;
 insert into public.audit_logs(actor_id,entity,entity_id,action) values(auth.uid(),'payment',p_id,case when p_confirm then 'confirmed' else 'rejected' end);
 perform private.notify((select user_id from public.applications where id=p.application_id),p.application_id,'ผลตรวจหลักฐานชำระเงิน',
 case when p_confirm then 'ยืนยันการชำระเงินแล้ว' else 'กรุณาแก้ไข: '||p_reason end,'payment:'||p_id);
end $$;
create function public.review_payment(p_id uuid,p_confirm boolean,p_reason text default '') returns void language sql set search_path='' as $$select private.review_payment(p_id,p_confirm,p_reason);$$;

create function private.admin_save(p_table text,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()); v_perm text; a public.applications;
begin
 v_perm=case when p_table in ('departments','recruitment_rounds','job_positions') then 'manage_jobs' when p_table='announcements' then 'publish' else 'exams' end;
 if not private.can(v_perm) then raise exception 'FORBIDDEN'; end if;
 case p_table
 when 'departments' then
  insert into public.departments(id,name,archived) values(v_id,p_data->>'name',coalesce((p_data->>'archived')::boolean,false))
  on conflict(id) do update set name=excluded.name,archived=excluded.archived;
 when 'recruitment_rounds' then
  insert into public.recruitment_rounds(id,name,year_be,opens_at,closes_at,max_per_user,published,archived)
  values(v_id,p_data->>'name',(p_data->>'year_be')::int,(p_data->>'opens_at')::timestamptz,(p_data->>'closes_at')::timestamptz,
  coalesce((p_data->>'max_per_user')::int,1),coalesce((p_data->>'published')::boolean,false),coalesce((p_data->>'archived')::boolean,false))
  on conflict(id) do update set name=excluded.name,year_be=excluded.year_be,opens_at=excluded.opens_at,closes_at=excluded.closes_at,max_per_user=excluded.max_per_user,published=excluded.published,archived=excluded.archived;
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
end $$;
create function public.admin_save(p_table text,p_data jsonb) returns uuid language sql set search_path='' as $$select private.admin_save(p_table,p_data);$$;
create function private.publish_results(p_job uuid,p_kind text,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; v_id uuid;
begin
 if not private.can('publish') then raise exception 'FORBIDDEN'; end if;
 if p_kind not in ('eligibility','selection') then raise exception 'INVALID_INPUT'; end if;
 if p_kind='selection' then
  select coalesce(jsonb_agg(jsonb_build_object('number',a.application_number,'name',concat_ws(' ',a.snapshot->'personal'->>'first_name',a.snapshot->'personal'->>'last_name'),'outcome',s.outcome) order by a.application_number),'[]') into v_rows
  from public.applications a join public.selection_results s on s.application_id=a.id where a.job_id=p_job;
  update public.selection_results set published=true where application_id in (select id from public.applications where job_id=p_job);
 else
  select coalesce(jsonb_agg(jsonb_build_object('number',a.application_number,'name',concat_ws(' ',a.snapshot->'personal'->>'first_name',a.snapshot->'personal'->>'last_name'),'outcome',a.status) order by a.application_number),'[]') into v_rows
  from public.applications a where a.job_id=p_job and a.status in ('eligible','ineligible');
 end if;
 if jsonb_array_length(v_rows)=0 then raise exception 'EMPTY_RESULTS'; end if;
 insert into public.published_results(job_id,title,kind,rows,approved_by) values(p_job,p_title,p_kind,v_rows)
 on conflict(job_id,kind) do update set title=excluded.title,rows=excluded.rows,approved_by=excluded.approved_by,published_at=now() returning id into v_id;
 insert into public.audit_logs(actor_id,entity,entity_id,action) values(auth.uid(),'published_results',v_id,'publish');
 return v_id;
end $$;
create function public.publish_results(p_job uuid,p_kind text,p_title text) returns uuid language sql set search_path='' as $$select private.publish_results(p_job,p_kind,p_title);$$;
create function private.set_role(p_user uuid,p_role public.app_role,p_permissions text[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.can('admin') then raise exception 'FORBIDDEN'; end if;
 if p_user=auth.uid() then raise exception 'SELF_ROLE_CHANGE'; end if;
 if exists(select 1 from unnest(p_permissions) x where x not in ('review','payments','manage_jobs','exams','publish','reports')) then raise exception 'INVALID_PERMISSION'; end if;
 update public.user_roles set role=p_role,permissions=case when p_role='hr' then p_permissions else '{}' end,granted_by=auth.uid(),updated_at=now() where user_id=p_user;
 if not found then raise exception 'NOT_FOUND'; end if;
 insert into public.audit_logs(actor_id,entity,entity_id,action,metadata) values(auth.uid(),'user_roles',p_user,'role',jsonb_build_object('role',p_role));
end $$;
create function public.set_role(p_user uuid,p_role public.app_role,p_permissions text[] default '{}') returns void language sql set search_path='' as $$select private.set_role(p_user,p_role,p_permissions);$$;
create function private.save_setting(p_key text,p_value jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.can('admin') then raise exception 'FORBIDDEN'; end if;
 if p_key not in ('contact','privacy','retention') or jsonb_typeof(p_value)<>'object' or length(p_value::text)>20000 then raise exception 'INVALID_INPUT'; end if;
 insert into public.app_settings(key,value) values(p_key,p_value) on conflict(key) do update set value=excluded.value,updated_at=now();
 insert into public.audit_logs(actor_id,entity,action,metadata) values(auth.uid(),'app_settings','save',jsonb_build_object('key',p_key));
end $$;
create function public.save_setting(p_key text,p_value jsonb) returns void language sql set search_path='' as $$select private.save_setting(p_key,p_value);$$;

-- Edge-only queue APIs: no browser role may claim or acknowledge email jobs.
create function public.claim_emails(p_limit int default 10) returns table(id uuid,email text,subject text,body text,lease_token uuid,attempts int)
language plpgsql security definer set search_path='' as $$
begin
 update public.email_outbox set status='failed',error_code='LEASE_EXHAUSTED' where status='processing' and lease_until<now() and attempts>=5;
 return query with todo as (select q.id from public.email_outbox q where q.attempts<5 and
 ((q.status='pending' and q.next_attempt_at<=now()) or (q.status='processing' and q.lease_until<now())) order by q.created_at for update skip locked limit least(greatest(p_limit,1),20)),
 claimed as (update public.email_outbox q set status='processing',attempts=q.attempts+1,lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid() from todo where q.id=todo.id returning q.*)
 select c.id,u.email::text,c.subject,c.body,c.lease_token,c.attempts from claimed c join auth.users u on u.id=c.user_id;
end $$;
create function public.finish_email(p_id uuid,p_lease uuid,p_ok boolean,p_code text default '') returns void language sql security definer set search_path='' as $$
 update public.email_outbox set status=case when p_ok then 'sent' when attempts>=5 then 'failed' else 'pending' end,
 sent_at=case when p_ok then now() end,error_code=left(p_code,100),lease_until=null,
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::int)) where id=p_id and lease_token=p_lease and status='processing';
$$;
create function public.claim_rate(p_scope text,p_key text,p_limit int) returns boolean language plpgsql security definer set search_path='' as $$
declare n int;
begin
 insert into private.rate_limits(scope,user_key,bucket,hits) values(p_scope,p_key,date_trunc('minute',now()),1)
 on conflict(scope,user_key,bucket) do update set hits=private.rate_limits.hits+1 returning hits into n;
 delete from private.rate_limits where bucket<now()-interval '1 day';
 return n<=p_limit;
end $$;

create function private.staff_list(p_filters jsonb,p_page int,p_size int,p_sort text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_where text; v_rows jsonb; v_count bigint; v_order text;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN'; end if;
 v_order=case p_sort when 'number' then 'a.application_number' when 'status' then 'a.status' else 'a.created_at desc' end;
 -- Parameter values stay in $1; only the allowlisted order expression is composed.
 v_where=' from public.applications a join public.job_positions j on j.id=a.job_id join public.recruitment_rounds r on r.id=j.round_id join public.departments d on d.id=j.department_id where
 (nullif($1->>''year'','''') is null or r.year_be=($1->>''year'')::int) and
 (nullif($1->>''round'','''') is null or r.id=($1->>''round'')::uuid) and
 (nullif($1->>''job'','''') is null or j.id=($1->>''job'')::uuid) and
 (nullif($1->>''department'','''') is null or d.id=($1->>''department'')::uuid) and
 (nullif($1->>''status'','''') is null or a.status::text=$1->>''status'') and
 (nullif($1->>''from'','''') is null or a.created_at>=($1->>''from'')::timestamptz) and
 (nullif($1->>''to'','''') is null or a.created_at<=($1->>''to'')::timestamptz) and
 (nullif($1->>''search'','''') is null or concat_ws('' '',a.application_number,a.personal_data->>''first_name'',a.personal_data->>''last_name'') ilike ''%''||left($1->>''search'',100)||''%'')';
 execute 'select count(*)'||v_where into v_count using p_filters;
 execute 'select coalesce(jsonb_agg(t),''[]''::jsonb) from (select a.id,a.status,a.payment_status,a.application_number,a.personal_data,a.created_at,a.submitted_at,j.title as job_title,d.name as department_name,r.name as round_name,r.year_be'||v_where||
 ' order by '||v_order||',a.id limit $2 offset $3) t' into v_rows using p_filters,least(greatest(p_size,1),100),greatest(p_page,0)*least(greatest(p_size,1),100);
 return jsonb_build_object('rows',v_rows,'count',v_count);
end $$;
create function public.staff_list(p_filters jsonb default '{}',p_page int default 0,p_size int default 20,p_sort text default 'created') returns jsonb language sql set search_path='' as $$select private.staff_list(p_filters,p_page,p_size,p_sort);$$;
create function private.staff_dashboard(p_filters jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN'; end if;
 with filtered as (
 select a.status,a.payment_status,j.title,d.name from public.applications a join public.job_positions j on j.id=a.job_id
 join public.recruitment_rounds r on r.id=j.round_id join public.departments d on d.id=j.department_id where
 (nullif(p_filters->>'year','') is null or r.year_be=(p_filters->>'year')::int) and
 (nullif(p_filters->>'round','') is null or r.id=(p_filters->>'round')::uuid) and
 (nullif(p_filters->>'job','') is null or j.id=(p_filters->>'job')::uuid) and
 (nullif(p_filters->>'department','') is null or d.id=(p_filters->>'department')::uuid) and
 (nullif(p_filters->>'status','') is null or a.status::text=p_filters->>'status') and
 (nullif(p_filters->>'from','') is null or a.created_at>=(p_filters->>'from')::timestamptz) and
 (nullif(p_filters->>'to','') is null or a.created_at<=(p_filters->>'to')::timestamptz) and
 (nullif(p_filters->>'search','') is null or concat_ws(' ',a.application_number,a.personal_data->>'first_name',a.personal_data->>'last_name') ilike '%'||left(p_filters->>'search',100)||'%')
 ) select jsonb_build_object('total',(select count(*) from filtered),'statuses',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from filtered group by status) s),'{}'),
 'payments',coalesce((select jsonb_object_agg(payment_status,n) from (select payment_status,count(*) n from filtered group by payment_status) s),'{}'),
 'jobs',coalesce((select jsonb_agg(x) from (select title as name,count(*) as value from filtered group by title order by count(*) desc) x),'[]'),
 'departments',coalesce((select jsonb_agg(x) from (select name,count(*) as value from filtered group by name order by count(*) desc) x),'[]')) into result;
 return result;
end $$;
create function public.staff_dashboard(p_filters jsonb default '{}') returns jsonb language sql set search_path='' as $$select private.staff_dashboard(p_filters);$$;
create function private.list_accounts(p_search text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if not private.can('admin') then raise exception 'FORBIDDEN'; end if;
 select coalesce(jsonb_agg(t),'[]') into v from (select u.id,u.email,p.first_name,p.last_name,r.role,r.permissions from auth.users u
 join public.profiles p on p.id=u.id join public.user_roles r on r.user_id=u.id
 where concat_ws(' ',u.email,p.first_name,p.last_name) ilike '%'||left(p_search,100)||'%' order by u.created_at desc limit 100) t;
 return v;
end $$;
create function public.list_accounts(p_search text default '') returns jsonb language sql set search_path='' as $$select private.list_accounts(p_search);$$;

-- Explicit grants and policies. Public clients have SELECT only except safe profile/notification columns.
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','departments','recruitment_rounds','job_positions','applications','application_education','application_experience','application_documents','application_document_versions','payment_records','application_status_history','staff_notes','exam_schedules','exam_assignments','selection_results','announcements','published_results','notifications','email_outbox','audit_logs','app_settings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on table public.%I from anon, authenticated',t);
 execute format('grant select on table public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.departments,public.recruitment_rounds,public.job_positions,public.announcements,public.published_results,public.exam_schedules,public.app_settings to anon;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_staff()));
grant update(prefix,first_name,last_name,phone,updated_at) on public.profiles to authenticated;
create policy profiles_edit on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy roles_read on public.user_roles for select to authenticated using(user_id=(select auth.uid()) or (select private.can('admin')));
create policy departments_read on public.departments for select to anon,authenticated using(not archived or (select private.is_staff()));
create policy rounds_read on public.recruitment_rounds for select to anon,authenticated using((published and not archived) or (select private.is_staff()));
create policy jobs_read on public.job_positions for select to anon,authenticated using((published and not archived and exists(select 1 from public.recruitment_rounds r where r.id=round_id and r.published and not r.archived)) or (select private.is_staff()));
create policy applications_read on public.applications for select to authenticated using(user_id=(select auth.uid()) or (select private.is_staff()));
do $$ declare t text; begin
 foreach t in array array['application_education','application_experience','application_documents','application_document_versions','payment_records','application_status_history'] loop
 execute format('create policy detail_read on public.%I for select to authenticated using(private.owns(application_id) or (select private.is_staff()))',t);
 end loop;
end $$;
grant insert on public.staff_notes to authenticated;
create policy notes_read on public.staff_notes for select to authenticated using((select private.is_staff()));
create policy notes_insert on public.staff_notes for insert to authenticated with check(author_id=(select auth.uid()) and (select private.can('review')));
create policy schedules_read on public.exam_schedules for select to anon,authenticated using(published or (select private.is_staff()));
create policy assignments_read on public.exam_assignments for select to authenticated using((private.owns(application_id) and exists(select 1 from public.exam_schedules s where s.id=schedule_id and s.published)) or (select private.is_staff()));
create policy selections_read on public.selection_results for select to authenticated using((published and private.owns(application_id)) or (select private.is_staff()));
create policy announcements_read on public.announcements for select to anon,authenticated using(published or (select private.is_staff()));
create policy results_read on public.published_results for select to anon,authenticated using(true);
create policy notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
grant update(read_at) on public.notifications to authenticated;
create policy notifications_edit on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy outbox_read on public.email_outbox for select to authenticated using((select private.can('admin')));
create policy audit_read on public.audit_logs for select to authenticated using((select private.can('admin')));
create policy settings_read on public.app_settings for select to anon,authenticated using(true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('application-files','application-files',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create policy recruitment_files_read on storage.objects for select to authenticated using(bucket_id='application-files' and
 exists(select 1 from public.application_documents d join public.applications a on a.id=d.application_id
 where d.storage_path=name and (a.user_id=(select auth.uid()) or (select private.is_staff())))
 or (bucket_id='application-files' and exists(select 1 from public.application_document_versions d join public.applications a on a.id=d.application_id
 where d.storage_path=name and (a.user_id=(select auth.uid()) or (select private.is_staff())))));
-- INSERT/UPDATE/DELETE deliberately handled by upload Edge Function. No direct client writes.

revoke execute on all functions in schema private from public, anon, authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('save_application','submit_application','review_application','check_upload','complete_upload','save_payment','review_payment','admin_save','publish_results','set_role','save_setting','claim_emails','finish_email','claim_rate','staff_list','staff_dashboard','list_accounts') loop
 execute format('revoke execute on function %s from public,anon,authenticated',f.sig);
 end loop;
end $$;
grant execute on function private.is_staff(),private.can(text) to anon,authenticated;
grant execute on function private.owns(uuid) to authenticated;
-- Wrapper and core signature are identical, with execution granted only to authenticated users.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname in ('save_application','submit_application','review_application','save_payment','review_payment','admin_save','publish_results','set_role','save_setting','staff_list','staff_dashboard','list_accounts') loop
 execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
end $$;
grant execute on function public.check_upload(uuid,text),private.check_upload(uuid,text,uuid) to authenticated;
grant execute on function public.complete_upload(uuid,uuid,text,text,text,text,int),public.claim_rate(text,text,int),public.claim_emails(int),public.finish_email(uuid,uuid,boolean,text) to service_role;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

insert into public.app_settings(key,value) values
 ('contact','{"department":"แผนกงานบริหารงานบุคคล","university":"มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น","address":"150 ถนนศรีจันทร์ ตำบลในเมือง อำเภอเมือง จังหวัดขอนแก่น 40000","phone":"","email":"","hours":"วันจันทร์–ศุกร์ ในเวลาราชการ"}'),
 ('privacy','{"version":"draft-1","text":"ร่างนโยบายสำหรับตั้งค่าระบบ: ใช้ข้อมูลเพื่อดำเนินการรับสมัครและคัดเลือกบุคลากร ผู้ดูแลต้องแก้ไขรายละเอียดผู้ควบคุมข้อมูล ระยะเวลาเก็บข้อมูล และช่องทางใช้สิทธิก่อนเปิดรับสมัครจริง"}'),
 ('retention','{"months":24,"note":"ค่าเริ่มต้นสำหรับทดสอบ ผู้ดูแลต้องกำหนดตามนโยบายหน่วยงาน ไม่มีการลบข้อมูลอัตโนมัติ"}');
