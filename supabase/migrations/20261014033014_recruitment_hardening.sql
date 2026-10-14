create index history_actor on public.application_status_history(actor_id);
create index audit_actor on public.audit_logs(actor_id);
create index notifications_application on public.notifications(application_id);
create index payments_document on public.payment_records(document_id);
create index payments_reviewer on public.payment_records(reviewed_by);
create index results_approver on public.published_results(approved_by);
create index selection_updater on public.selection_results(updated_by);
create index roles_granter on public.user_roles(granted_by);
create policy internal_only on private.year_counters for all to service_role using(true) with check(true);
create policy internal_only on private.rate_limits for all to service_role using(true) with check(true);

-- Retain access to position/round metadata for existing applicants after archiving.
create function private.owns_job(p_job uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.applications where user_id=auth.uid() and job_id=p_job);
$$;
create function private.owns_round(p_round uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.applications a join public.job_positions j on j.id=a.job_id where a.user_id=auth.uid() and j.round_id=p_round);
$$;
revoke execute on function private.owns_job(uuid),private.owns_round(uuid) from public;
grant execute on function private.owns_job(uuid),private.owns_round(uuid) to anon,authenticated;
alter policy jobs_read on public.job_positions using((published and not archived and exists(select 1 from public.recruitment_rounds r where r.id=round_id and r.published and not r.archived)) or (select private.is_staff()) or private.owns_job(id));
alter policy rounds_read on public.recruitment_rounds using((published and not archived) or (select private.is_staff()) or private.owns_round(id));

-- Applicant-visible notifications use Thai state labels.
create or replace function private.state_log() returns trigger language plpgsql security definer set search_path='' as $$
declare v_label text;
begin
 if tg_op='INSERT' or new.status is distinct from old.status then
  insert into public.application_status_history(application_id,from_status,to_status,message,actor_id)
  values(new.id,case when tg_op='UPDATE' then old.status end,new.status,new.public_message,auth.uid());
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'application',new.id,'status',jsonb_build_object('status',new.status));
  v_label=case new.status when 'submitted' then 'ส่งใบสมัครแล้ว' when 'under_review' then 'กำลังตรวจสอบ' when 'needs_correction' then 'ต้องแก้ไขเอกสาร' when 'eligible' then 'ผ่านคุณสมบัติ' when 'ineligible' then 'ไม่ผ่านคุณสมบัติ' when 'withdrawn' then 'ถอนใบสมัครแล้ว' else 'แบบร่าง' end;
  if new.status<>'draft' then
   perform private.notify(new.user_id,new.id,'อัปเดตใบสมัคร '||coalesce(new.application_number,''),
    'สถานะ: '||v_label||case when new.public_message<>'' then E'\n'||new.public_message else '' end,new.id||':'||new.status||':'||new.updated_at);
  end if;
 end if;
 return new;
end $$;
