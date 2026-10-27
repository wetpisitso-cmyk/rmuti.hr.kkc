-- Official exam-card regulations must be explicitly approved by an Admin per recruitment round.
alter table public.exam_card_round_settings
 add column if not exists rules_approved_by uuid references auth.users(id) on delete set null,
 add column if not exists rules_approved_at timestamptz,
 add column if not exists rules_version text;

create or replace function public.admin_exam_card_approve_rules(p_round uuid,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin')
 then raise exception 'FORBIDDEN'; end if;
 if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED'; end if;
 if not exists(select 1 from public.recruitment_rounds where id=p_round)
 then raise exception 'ROUND_NOT_FOUND'; end if;
 insert into public.exam_card_round_settings(round_id,issue_label,updated_by,
  rules_approved_by,rules_approved_at,rules_version)
 values(p_round,'ครั้งที่ 40 / 2569',auth.uid(),auth.uid(),clock_timestamp(),'original-20261027-v1')
 on conflict(round_id) do update set
  rules_approved_by=excluded.rules_approved_by,rules_approved_at=excluded.rules_approved_at,
  rules_version=excluded.rules_version;
 insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
 values(auth.uid(),'exam_card_round_settings',p_round,'approve_exam_card_rules',
  jsonb_build_object('rules_version','original-20261027-v1'));
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
  if not exists (select 1 from public.job_positions j join public.exam_card_round_settings cfg on cfg.round_id=j.round_id
     where j.id=v.job_id and cfg.rules_approved_at is not null and cfg.rules_version='original-20261027-v1')
  then raise exception 'EXAM_CARD_RULES_NOT_APPROVED'; end if;
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
      j.id as job_id,j.title as job_title,d.id as department_id,d.name as department,
      r.id as round_id,r.name as round_name,r.year_be,
      coalesce(cfg.issue_label,'ครั้งที่ 40 / 2569') as issue_label,
      s.published as schedule_published,
      (cfg.rules_approved_at is not null and cfg.rules_version='original-20261027-v1') as rules_approved,
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

create or replace function public.admin_exam_card_history(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin')
 then raise exception 'FORBIDDEN'; end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v
 from (
  select action,metadata,created_at
  from public.audit_logs
  where entity='exam_card_issues' and entity_id=p_assignment
  order by created_at desc limit 30
 ) t;
 return v;
end $$;

revoke all on function public.admin_exam_card_approve_rules(uuid,boolean),
 public.admin_exam_card_history(uuid) from public,anon;
grant execute on function public.admin_exam_card_approve_rules(uuid,boolean),
 public.admin_exam_card_history(uuid) to authenticated;
