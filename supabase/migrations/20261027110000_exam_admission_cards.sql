-- Exam admission cards: reuse exam_assignments and existing per-application admin signature.
-- No historical application row is updated.
create table if not exists public.exam_card_round_settings (
  round_id uuid primary key references public.recruitment_rounds(id) on delete restrict,
  issue_label text not null default 'ครั้งที่ 40 / 2569'
    check (length(btrim(issue_label)) between 5 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.exam_card_issues (
  assignment_id uuid primary key references public.exam_assignments(id) on delete restrict,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint valid_exam_card_revocation check ((revoked_by is null) = (revoked_at is null))
);
alter table public.exam_card_round_settings enable row level security;
alter table public.exam_card_issues enable row level security;
revoke all on public.exam_card_round_settings,public.exam_card_issues from public,anon,authenticated;
-- Access through the carefully scoped RPCs only, not direct REST table CRUD.

create or replace function public.admin_exam_card_set_round(p_round uuid,p_label text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from public.user_roles
                 where user_id=auth.uid() and role='admin')
  then raise exception 'FORBIDDEN'; end if;
  if length(btrim(coalesce(p_label,''))) not between 5 and 100
  then raise exception 'INVALID_EXAM_ROUND_LABEL'; end if;
  if not exists (select 1 from public.recruitment_rounds where id=p_round)
  then raise exception 'ROUND_NOT_FOUND'; end if;
  insert into public.exam_card_round_settings(round_id,issue_label,updated_by)
  values(p_round,btrim(p_label),auth.uid())
  on conflict(round_id) do update set
    issue_label=excluded.issue_label,updated_by=excluded.updated_by,
    updated_at=clock_timestamp();
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'exam_card_round_settings',p_round,'set_exam_card_round',
    jsonb_build_object('label',btrim(p_label)));
end $$;

create or replace function public.admin_exam_card_issue(p_assignment uuid,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v record;
begin
  if not exists (select 1 from public.user_roles
                 where user_id=auth.uid() and role='admin')
  then raise exception 'FORBIDDEN'; end if;
  if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED'; end if;
  select ea.id as assignment_id,ea.exam_number,ea.schedule_id,
         a.id as application_id,a.status,a.application_number,a.snapshot,a.payment_status,
         s.published,s.job_id as schedule_job_id,a.job_id,
         sig.signature_png,sig.application_number_at_signing,sig.signed_snapshot_md5,
         pa.approved_at,pa.approved_snapshot_md5,pa.application_number_at_approval,
         sig.signed_at
  into v from public.exam_assignments ea
  join public.exam_schedules s on s.id=ea.schedule_id
  join public.applications a on a.id=ea.application_id
  left join public.application_admin_signatures sig on sig.application_id=a.id
  left join public.application_print_approvals pa on pa.application_id=a.id
  where ea.id=p_assignment and a.archived_at is null
  for update of ea;
  if not found then raise exception 'EXAM_ASSIGNMENT_NOT_FOUND'; end if;
  if v.status::text<>'eligible' or v.published is distinct from true
     or v.schedule_job_id<>v.job_id or v.snapshot is null
     or nullif(btrim(v.exam_number),'') is null
     or v.payment_status::text not in ('confirmed','not_required')
  then raise exception 'NOT_ELIGIBLE_FOR_EXAM_CARD'; end if;
  if v.signature_png is null
     or v.application_number_at_signing is distinct from v.application_number
     or v.signed_snapshot_md5 is distinct from md5(v.snapshot::text)
     or v.approved_snapshot_md5 is distinct from md5(v.snapshot::text)
     or v.application_number_at_approval is distinct from v.application_number
     or v.approved_at is null or v.approved_at<v.signed_at
  then raise exception 'VALID_ADMIN_SIGNATURE_AND_APPROVAL_REQUIRED'; end if;
  if not exists (select 1 from public.application_documents
                 where application_id=v.application_id and document_type='photo')
  then raise exception 'APPLICANT_PHOTO_REQUIRED'; end if;
  insert into public.exam_card_issues(assignment_id,issued_by)
  values(p_assignment,auth.uid())
  on conflict(assignment_id) do update set
    issued_by=excluded.issued_by,issued_at=clock_timestamp(),
    revoked_by=null,revoked_at=null;
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'exam_card_issues',p_assignment,'issue_exam_card',
    jsonb_build_object('application_id',v.application_id,'exam_number',v.exam_number));
end $$;

create or replace function public.admin_exam_card_revoke(p_assignment uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin')
  then raise exception 'FORBIDDEN'; end if;
  if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  update public.exam_card_issues
    set revoked_by=auth.uid(),revoked_at=clock_timestamp()
  where assignment_id=p_assignment and revoked_at is null;
  if not found then raise exception 'ACTIVE_CARD_NOT_FOUND'; end if;
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'exam_card_issues',p_assignment,'revoke_exam_card',
    jsonb_build_object('reason',left(btrim(p_reason),500)));
end $$;

create or replace function public.exam_card_info(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v record;
begin
  select ea.id,a.id as application_id,a.user_id,a.status,a.archived_at,
    a.application_number,ea.exam_number,
    a.personal_data->>'prefix' as prefix,
    a.personal_data->>'first_name' as first_name,
    a.personal_data->>'last_name' as last_name,
    j.title as job_title,d.name as department,
    r.id as round_id,r.year_be,r.name as round_name,
    coalesce(cfg.issue_label,'ครั้งที่ 40 / 2569') as issue_label,
    s.title as exam_title,s.exam_at,s.venue,s.published,
    issue.issued_at,issue.revoked_at,
    (select ad.storage_path from public.application_documents ad
      where ad.application_id=a.id and ad.document_type='photo'
      order by ad.uploaded_at desc limit 1) as photo_path,
    sig.signature_png,sig.signer_name,
    sig.application_number_at_signing,sig.signed_snapshot_md5,sig.signed_at,
    pa.approved_snapshot_md5,pa.application_number_at_approval,pa.approved_at,
    a.snapshot,a.payment_status
  into v from public.exam_assignments ea
  join public.exam_schedules s on s.id=ea.schedule_id
  join public.applications a on a.id=ea.application_id
  join public.job_positions j on j.id=a.job_id and j.id=s.job_id
  join public.departments d on d.id=j.department_id
  join public.recruitment_rounds r on r.id=j.round_id
  left join public.exam_card_round_settings cfg on cfg.round_id=r.id
  left join public.exam_card_issues issue on issue.assignment_id=ea.id
  left join public.application_admin_signatures sig on sig.application_id=a.id
  left join public.application_print_approvals pa on pa.application_id=a.id
  where ea.id=p_assignment;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not(v.user_id=auth.uid() or private.can('exams'))
  then raise exception 'FORBIDDEN'; end if;
  if v.status::text<>'eligible' or v.archived_at is not null
     or v.issued_at is null or v.revoked_at is not null
     or v.published is distinct from true
     or v.payment_status::text not in ('confirmed','not_required')
     or v.photo_path is null
     or v.signature_png is null
     or v.application_number_at_signing is distinct from v.application_number
     or v.signed_snapshot_md5 is distinct from md5(v.snapshot::text)
     or v.approved_snapshot_md5 is distinct from md5(v.snapshot::text)
     or v.application_number_at_approval is distinct from v.application_number
     or v.approved_at is null or v.approved_at<v.signed_at
  then raise exception 'EXAM_CARD_NOT_AVAILABLE'; end if;
  return jsonb_build_object(
    'assignment_id',v.id,'application_id',v.application_id,
    'exam_number',v.exam_number,
    'name',concat_ws(' ',nullif(v.prefix,''),nullif(v.first_name,''),nullif(v.last_name,'')),
    'job_title',v.job_title,'department',v.department,
    'issue_label',v.issue_label,'year_be',v.year_be,'round_name',v.round_name,
    'photo_path',v.photo_path,'signature_png',v.signature_png,
    'signer_name',v.signer_name,'issued_at',v.issued_at);
end $$;

create or replace function public.exam_card_list(p_round uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if not private.can('exams') then raise exception 'FORBIDDEN'; end if;
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_rows
  from (
    select ea.id as assignment_id,a.id as application_id,
      a.application_number,ea.exam_number,
      concat_ws(' ',a.personal_data->>'prefix',a.personal_data->>'first_name',
        a.personal_data->>'last_name') as applicant_name,
      j.title as job_title,d.name as department,
      r.id as round_id,r.name as round_name,r.year_be,
      coalesce(cfg.issue_label,'ครั้งที่ 40 / 2569') as issue_label,
      s.published as schedule_published,
      issue.issued_at,issue.revoked_at,
      exists(select 1 from public.application_documents photo
        where photo.application_id=a.id and photo.document_type='photo') as has_photo,
      exists(select 1 from public.application_admin_signatures sig
        join public.application_print_approvals pa on pa.application_id=sig.application_id
        where sig.application_id=a.id and sig.signed_snapshot_md5=md5(a.snapshot::text)
          and sig.application_number_at_signing=a.application_number
          and pa.approved_snapshot_md5=md5(a.snapshot::text)
          and pa.application_number_at_approval=a.application_number
          and pa.approved_at >= sig.signed_at) as has_signature,
      a.status::text as status
    from public.exam_assignments ea
    join public.exam_schedules s on s.id=ea.schedule_id
    join public.applications a on a.id=ea.application_id and a.job_id=s.job_id
    join public.job_positions j on j.id=a.job_id
    join public.departments d on d.id=j.department_id
    join public.recruitment_rounds r on r.id=j.round_id
    left join public.exam_card_round_settings cfg on cfg.round_id=r.id
    left join public.exam_card_issues issue on issue.assignment_id=ea.id
    where (p_round is null or r.id=p_round) and a.archived_at is null
      and a.status::text='eligible'
    order by r.year_be desc,j.title,ea.exam_number
    limit 5000
  ) t;
  return v_rows;
end $$;

revoke all on function public.admin_exam_card_set_round(uuid,text),
 public.admin_exam_card_issue(uuid,boolean),public.admin_exam_card_revoke(uuid,text),
 public.exam_card_info(uuid),public.exam_card_list(uuid)
 from public,anon;
grant execute on function public.admin_exam_card_set_round(uuid,text),
 public.admin_exam_card_issue(uuid,boolean),public.admin_exam_card_revoke(uuid,text),
 public.exam_card_info(uuid),public.exam_card_list(uuid)
 to authenticated;
