-- Preserve the immutable identity of each issued exam card.
-- Exam numbers or application contents changing afterwards must not silently
-- replace what was previously certified. Existing issued rows are backfilled.
alter table public.exam_card_issues
 add column if not exists exam_number_at_issue text,
 add column if not exists issue_label_at_issue text,
 add column if not exists snapshot_md5_at_issue text;

update public.exam_card_issues card
 set exam_number_at_issue = ea.exam_number,
     issue_label_at_issue = coalesce(cfg.issue_label,'ครั้งที่ 40 / 2569'),
     snapshot_md5_at_issue = md5(a.snapshot::text)
 from public.exam_assignments ea
 join public.applications a on a.id=ea.application_id
 join public.job_positions j on j.id=a.job_id
 left join public.exam_card_round_settings cfg on cfg.round_id=j.round_id
 where card.assignment_id=ea.id
   and (card.exam_number_at_issue is null or card.issue_label_at_issue is null
        or card.snapshot_md5_at_issue is null);

alter table public.exam_card_issues
 alter column exam_number_at_issue set not null,
 alter column issue_label_at_issue set not null,
 alter column snapshot_md5_at_issue set not null;

create or replace function public.admin_exam_card_issue(p_assignment uuid,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v record;
begin
  if not exists (select 1 from public.user_roles
                 where user_id=auth.uid() and role='admin')
  then raise exception 'FORBIDDEN'; end if;
  if p_confirm is distinct from true then raise exception 'CONFIRM_REQUIRED'; end if;
  -- Assignment row lock below prevents concurrent issuance of the same number.
  select ea.id as assignment_id,ea.exam_number,ea.schedule_id,
         a.id as application_id,a.status,a.application_number,a.snapshot,a.payment_status,
         s.published,s.job_id as schedule_job_id,a.job_id,
         cfg.issue_label,
         sig.signature_png,sig.application_number_at_signing,sig.signed_snapshot_md5,
         pa.approved_at,pa.approved_snapshot_md5,pa.application_number_at_approval,
         sig.signed_at
  into v from public.exam_assignments ea
  join public.exam_schedules s on s.id=ea.schedule_id
  join public.applications a on a.id=ea.application_id
  join public.job_positions j on j.id=a.job_id
  left join public.exam_card_round_settings cfg on cfg.round_id=j.round_id
  left join public.application_admin_signatures sig on sig.application_id=a.id
  left join public.application_print_approvals pa on pa.application_id=a.id
  where ea.id=p_assignment and a.archived_at is null
  for update of ea;
  if not found then raise exception 'EXAM_ASSIGNMENT_NOT_FOUND'; end if;
  if exists (select 1 from public.exam_card_issues
             where assignment_id=p_assignment and revoked_at is null)
  then raise exception 'EXAM_CARD_ALREADY_ISSUED'; end if;
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
                 where application_id=v.application_id and document_type='photo'
                   and mime_type like 'image/%')
  then raise exception 'APPLICANT_PHOTO_REQUIRED'; end if;
  insert into public.exam_card_issues(assignment_id,issued_by,exam_number_at_issue,issue_label_at_issue,snapshot_md5_at_issue)
  values(p_assignment,auth.uid(),v.exam_number,v.issue_label,md5(v.snapshot::text))
  on conflict(assignment_id) do update set
    issued_by=excluded.issued_by,issued_at=clock_timestamp(),
    exam_number_at_issue=excluded.exam_number_at_issue,
    issue_label_at_issue=excluded.issue_label_at_issue,
    snapshot_md5_at_issue=excluded.snapshot_md5_at_issue,
    revoked_by=null,revoked_at=null;
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'exam_card_issues',p_assignment,'issue_exam_card',
    jsonb_build_object('application_id',v.application_id,'exam_number',v.exam_number));
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
    issue.exam_number_at_issue,issue.issue_label_at_issue,issue.snapshot_md5_at_issue,
    (select ad.storage_path from public.application_documents ad
      where ad.application_id=a.id and ad.document_type='photo' and ad.mime_type like 'image/%'
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
     or v.exam_number is distinct from v.exam_number_at_issue
     or md5(v.snapshot::text) is distinct from v.snapshot_md5_at_issue
     or v.signature_png is null
     or v.application_number_at_signing is distinct from v.application_number
     or v.signed_snapshot_md5 is distinct from md5(v.snapshot::text)
     or v.approved_snapshot_md5 is distinct from md5(v.snapshot::text)
     or v.application_number_at_approval is distinct from v.application_number
     or v.approved_at is null or v.approved_at<v.signed_at
  then raise exception 'EXAM_CARD_NOT_AVAILABLE'; end if;
  return jsonb_build_object(
    'assignment_id',v.id,'application_id',v.application_id,
    'exam_number',v.exam_number_at_issue,
    'name',concat_ws(' ',nullif(v.prefix,''),nullif(v.first_name,''),nullif(v.last_name,'')),
    'job_title',v.job_title,'department',v.department,
    'issue_label',v.issue_label_at_issue,'year_be',v.year_be,'round_name',v.round_name,
    'photo_path',v.photo_path,'signature_png',v.signature_png,
    'signer_name',v.signer_name,'issued_at',v.issued_at);
end $$;

create or replace function public.my_exam_cards()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ea.id,'application_id',a.id)),'[]'::jsonb) into v_rows
  from public.exam_card_issues ci
  join public.exam_assignments ea on ea.id=ci.assignment_id
  join public.exam_schedules sc on sc.id=ea.schedule_id
  join public.applications a on a.id=ea.application_id and a.job_id=sc.job_id
  join public.application_admin_signatures sig on sig.application_id=a.id
  join public.application_print_approvals pa on pa.application_id=a.id
  where a.user_id=auth.uid() and a.archived_at is null
   and a.status::text='eligible' and ci.revoked_at is null
   and ea.exam_number=ci.exam_number_at_issue
   and md5(a.snapshot::text)=ci.snapshot_md5_at_issue
   and sc.published is true and a.payment_status::text in ('confirmed','not_required')
   and sig.application_number_at_signing=a.application_number
   and sig.signed_snapshot_md5=md5(a.snapshot::text)
   and pa.application_number_at_approval=a.application_number
   and pa.approved_snapshot_md5=md5(a.snapshot::text)
   and pa.approved_at>=sig.signed_at
   and exists(select 1 from public.application_documents photo
       where photo.application_id=a.id and photo.document_type='photo' and photo.mime_type like 'image/%');
  return v_rows;
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
      issue.exam_number_at_issue,
      (issue.issued_at is not null and issue.revoked_at is null
       and ea.exam_number=issue.exam_number_at_issue
       and md5(a.snapshot::text)=issue.snapshot_md5_at_issue) as card_current,
      exists(select 1 from public.application_documents photo
        where photo.application_id=a.id and photo.document_type='photo' and photo.mime_type like 'image/%') as has_photo,
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
