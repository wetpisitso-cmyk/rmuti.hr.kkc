-- Applicant lifecycle mail. Safe default: disabled, no historical backfill, no sending.
-- Keep in-app notifications independent of the email delivery queue.
insert into public.app_settings(key,value)
values ('applicant_mail', jsonb_build_object(
  'enabled',false,'active_since',null,
  'events',jsonb_build_array('application_submitted','payment_confirmed','eligibility_passed',
    'eligibility_failed','exam_schedule_published','exam_card_issued','selection_published')
))
on conflict(key) do nothing;

alter table public.email_outbox add column if not exists event_type text;
alter table public.email_outbox add column if not exists application_id uuid references public.applications(id) on delete set null;

-- Previous private.notify inserted email jobs even without a deployed sender. It now
-- preserves existing in-app notifications only. New email events have separate gates.
create or replace function private.notify(
  p_user uuid,p_app uuid,p_title text,p_message text,p_key text
) returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(user_id,application_id,title,message)
  values(p_user,p_app,p_title,p_message);
end $$;

create or replace function private.enqueue_applicant_mail(
  p_event text, p_app uuid, p_fingerprint text, p_details text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_config jsonb;
  v_user uuid;
  v_number text;
  v_position text;
  v_subject text;
  v_body text;
  v_label text;
begin
  select value into v_config from public.app_settings where key='applicant_mail';
  if coalesce(v_config->>'enabled','false') <> 'true'
     or nullif(v_config->>'active_since','') is null
     or not coalesce(v_config->'events' ? p_event,false)
  then return; end if;

  select a.user_id,a.application_number,j.title
  into v_user,v_number,v_position
  from public.applications a join public.job_positions j on j.id=a.job_id
  where a.id=p_app and a.archived_at is null and a.status <> 'withdrawn';
  if v_user is null then return; end if;

  v_label := case p_event
    when 'application_submitted' then 'ได้รับใบสมัครของท่านแล้ว'
    when 'payment_confirmed' then 'ตรวจสอบการชำระค่าสมัครผ่านแล้ว'
    when 'eligibility_passed' then 'ผลตรวจคุณสมบัติ: ผ่านคุณสมบัติ'
    when 'eligibility_failed' then 'ผลตรวจคุณสมบัติ: ไม่ผ่านคุณสมบัติ'
    when 'exam_schedule_published' then 'ประกาศกำหนดวัน เวลา และสถานที่สอบ'
    when 'exam_card_issued' then 'ออกบัตรประจำตัวผู้สมัครสอบแล้ว'
    when 'selection_published' then 'ประกาศผลการสอบแล้ว'
    else null end;
  if v_label is null then return; end if;

  v_subject := 'มทร.อีสาน วิทยาเขตขอนแก่น | '||v_label;
  v_body := 'เรียน ผู้สมัครสอบ'||E'\n\n'||v_label||E'\n'
    ||'ตำแหน่ง: '||coalesce(left(v_position,200),'')||E'\n'
    ||'เลขที่ใบสมัคร: '||coalesce(left(v_number,100),'รอออกเลข')||E'\n'
    ||case when nullif(btrim(coalesce(p_details,'')),'') is not null
      then left(btrim(p_details),1200)||E'\n' else '' end
    ||E'\nกรุณาเข้าสู่ระบบรับสมัครงานเพื่อตรวจสอบข้อมูลล่าสุด: '
    ||'https://wetpisitso-cmyk.github.io/rmuti.hr.kkc/'
    ||E'\n\nงานบริหารงานบุคคล มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น'
    ||E'\n(อีเมลแจ้งเตือนอัตโนมัติ กรุณาอย่าตอบกลับ)';
  insert into public.email_outbox(user_id,application_id,event_type,subject,body,dedup_key)
  values(v_user,p_app,p_event,v_subject,v_body,
    'applicant-mail:v1:'||p_event||':'||p_app::text||':'||md5(coalesce(p_fingerprint,'')))
  on conflict(dedup_key) do nothing;
end $$;

create or replace function private.application_mail_status_event()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    if new.status='submitted' then
      perform private.enqueue_applicant_mail('application_submitted',new.id,'submitted');
    elsif new.status='eligible' then
      perform private.enqueue_applicant_mail('eligibility_passed',new.id,'eligible');
    elsif new.status='ineligible' then
      perform private.enqueue_applicant_mail('eligibility_failed',new.id,'ineligible');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists application_mail_status_event on public.applications;
create trigger application_mail_status_event after insert or update of status
on public.applications for each row execute function private.application_mail_status_event();

create or replace function private.payment_mail_event()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='confirmed' and
     (tg_op='INSERT' or new.status is distinct from old.status) then
    perform private.enqueue_applicant_mail('payment_confirmed',new.application_id,'payment');
  end if;
  return new;
end $$;
drop trigger if exists payment_mail_event on public.payment_records;
create trigger payment_mail_event after insert or update of status
on public.payment_records for each row execute function private.payment_mail_event();

create or replace function private.exam_schedule_mail_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_app record; v_key text; v_info text;
begin
  if new.published is distinct from true then return new; end if;
  if tg_op='UPDATE' and old.published is true and
     row(old.title,old.exam_at,old.venue,old.instructions)
       is not distinct from
     row(new.title,new.exam_at,new.venue,new.instructions)
  then return new; end if;
  v_key := new.id::text||':'||md5(
     coalesce(new.title,'')||'|'||coalesce(new.exam_at::text,'')||'|'||
     coalesce(new.venue,'')||'|'||coalesce(new.instructions,''));
  v_info := 'วันและเวลา: '||to_char(new.exam_at at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI')
       ||E'\nสถานที่สอบ: '||coalesce(new.venue,'');
  for v_app in select id from public.applications
    where job_id=new.job_id and status='eligible' and archived_at is null
  loop
    perform private.enqueue_applicant_mail('exam_schedule_published',v_app.id,v_key,v_info);
  end loop;
  return new;
end $$;
drop trigger if exists exam_schedule_mail_event on public.exam_schedules;
create trigger exam_schedule_mail_event after insert or update
on public.exam_schedules for each row execute function private.exam_schedule_mail_event();

create or replace function private.exam_card_mail_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_app uuid;
begin
  if new.revoked_at is not null then return new; end if;
  if tg_op='UPDATE' and old.revoked_at is null then return new; end if;
  select application_id into v_app from public.exam_assignments
   where id=new.assignment_id;
  if v_app is not null then
    perform private.enqueue_applicant_mail('exam_card_issued',v_app,
      new.assignment_id::text||':'||new.issued_at::text);
  end if;
  return new;
end $$;
drop trigger if exists exam_card_mail_event on public.exam_card_issues;
create trigger exam_card_mail_event after insert or update
on public.exam_card_issues for each row execute function private.exam_card_mail_event();

create or replace function private.selection_publication_mail_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_app record;
begin
  if tg_op='UPDATE' and old.published_at is not distinct from new.published_at
    and old.rows is not distinct from new.rows then return new; end if;
  if new.kind not in ('selection','eligibility') then return new; end if;
  for v_app in select a.id from public.applications a
     where a.job_id=new.job_id and a.archived_at is null
       and a.status in ('eligible','ineligible')
       and a.application_number is not null
       and exists (
         select 1 from jsonb_array_elements(coalesce(new.rows,'[]'::jsonb)) v(item)
         where v.item->>'number'=a.application_number
       )
  loop
    perform private.enqueue_applicant_mail('selection_published',v_app.id,
      new.id::text||':'||new.published_at::text||':'||new.kind,
      'ประกาศ: '||left(coalesce(new.title,''),200));
  end loop;
  return new;
end $$;
drop trigger if exists selection_publication_mail_event on public.published_results;
create trigger selection_publication_mail_event after insert or update
on public.published_results for each row execute function private.selection_publication_mail_event();

-- Staff may select events, but activation is always explicit (disabled by default).
create or replace function public.admin_set_applicant_mail_settings(
  p_enabled boolean, p_events text[]
) returns void language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_since timestamptz;
begin
  if not private.can('admin') then raise exception 'FORBIDDEN'; end if;
  if p_enabled is null or p_events is null or cardinality(p_events)>7
    or exists (select 1 from unnest(p_events) e
      where e is null or e not in (
        'application_submitted','payment_confirmed','eligibility_passed',
        'eligibility_failed','exam_schedule_published','exam_card_issued',
        'selection_published'))
    or cardinality(p_events) <> (select count(distinct e) from unnest(p_events) e)
  then raise exception 'INVALID_MAIL_EVENTS'; end if;
  select value into v_old from public.app_settings where key='applicant_mail' for update;
  v_since := case when p_enabled
    then case when coalesce(v_old->>'enabled','false')='true'
      then (v_old->>'active_since')::timestamptz else clock_timestamp() end
    else null end;
  insert into public.app_settings(key,value)
  values('applicant_mail',jsonb_build_object('enabled',p_enabled,
    'active_since',v_since,'events',to_jsonb(p_events)))
  on conflict(key) do update set value=excluded.value,updated_at=clock_timestamp();
  insert into public.audit_logs(actor_id,entity,action,metadata)
  values(auth.uid(),'app_settings','applicant_mail_config',
    jsonb_build_object('enabled',p_enabled,'events',to_jsonb(p_events)));
end $$;
revoke all on function public.admin_set_applicant_mail_settings(boolean,text[]) from public,anon;
grant execute on function public.admin_set_applicant_mail_settings(boolean,text[]) to authenticated;

-- The worker can only claim jobs created by this new feature after activation.
create or replace function public.claim_emails(p_limit integer default 10)
 returns table(id uuid,email text,subject text,body text,lease_token uuid,attempts integer)
 language plpgsql security definer set search_path='' as $$
begin
  update public.email_outbox q set status='failed',error_code='LEASE_EXHAUSTED'
    where q.status='processing' and q.lease_until<now() and q.attempts>=5;
  return query with todo as (
    select q.id from public.email_outbox q
      join public.app_settings cfg on cfg.key='applicant_mail'
    where cfg.value->>'enabled'='true'
      and q.event_type is not null
      and q.created_at >= (cfg.value->>'active_since')::timestamptz
      and q.attempts<5
      and ((q.status='pending' and q.next_attempt_at<=now())
       or (q.status='processing' and q.lease_until<now()))
    order by q.created_at for update of q skip locked
    limit least(greatest(p_limit,1),20)
  ), claimed as (
    update public.email_outbox q
    set status='processing',attempts=q.attempts+1,lease_until=now()+interval '3 minutes',
      lease_token=gen_random_uuid()
    from todo where q.id=todo.id returning q.*
  )
  select c.id,u.email::text,c.subject,c.body,c.lease_token,c.attempts
  from claimed c join auth.users u on u.id=c.user_id
  where u.email is not null;
end $$;
revoke all on function public.claim_emails(integer) from public,anon,authenticated;
grant execute on function public.claim_emails(integer) to service_role;
revoke all on function public.finish_email(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_email(uuid,uuid,boolean,text) to service_role;
