-- Already applied to production; versioned source for other environments.
create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete restrict,
  payment_id uuid not null unique references public.payment_records(id) on delete restrict,
  receipt_number text not null unique,
  year_be integer not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null,
  issued_at timestamptz not null default clock_timestamp(),
  issued_by uuid not null references auth.users(id),
  details jsonb not null check (jsonb_typeof(details) = 'object')
);
create table if not exists private.receipt_counters (
 year_be integer primary key,
 last_value bigint not null default 0 check(last_value >= 0)
);
alter table public.payment_receipts enable row level security;
revoke all on public.payment_receipts from public,anon,authenticated;
grant select on public.payment_receipts to authenticated;
create policy "receipts_applicant_and_finance_read" on public.payment_receipts
for select to authenticated using (
 exists (select 1 from public.applications a where a.id=application_id and
 (a.user_id=(select auth.uid()) or (select private.can('payments'))))
);
CREATE OR REPLACE FUNCTION private.guard_payment_receipt()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  raise exception 'RECEIPT_IMMUTABLE';
end
$function$
;

CREATE OR REPLACE FUNCTION private.issue_payment_receipt(p_payment uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_payment public.payment_records;
  v_application public.applications;
  v_job public.job_positions;
  v_department text;
  v_issuer text;
  v_bank jsonb;
  v_number text;
  v_year integer;
  v_serial bigint;
  v_name text;
begin
  if not private.can('payments') then raise exception 'FORBIDDEN'; end if;
  select * into v_payment from public.payment_records where id = p_payment for update;
  if v_payment.id is null or v_payment.status <> 'confirmed' or v_payment.reviewed_at is null
     or v_payment.reviewed_by is null then
    raise exception 'PAYMENT_NOT_CONFIRMED';
  end if;

  select receipt_number into v_number from public.payment_receipts where payment_id = p_payment;
  if v_number is not null then return v_number; end if;

  select * into v_application from public.applications where id=v_payment.application_id for update;
  if v_application.id is null or v_application.payment_status <> 'confirmed' then
    raise exception 'PAYMENT_NOT_CONFIRMED';
  end if;
  if exists(select 1 from public.payment_receipts where application_id=v_application.id) then
    raise exception 'RECEIPT_ALREADY_ISSUED';
  end if;

  select * into v_job from public.job_positions where id=v_application.job_id;
  select d.name into v_department from public.departments d where d.id=v_job.department_id;
  select value->>'university' into v_issuer from public.app_settings where key='contact';
  select value into v_bank from public.app_settings where key='payment';
  v_name := btrim(concat_ws(' ',
    nullif(v_application.personal_data->>'prefix',''),
    nullif(v_application.personal_data->>'first_name',''),
    nullif(v_application.personal_data->>'last_name','')
  ));
  v_year := extract(year from timezone('Asia/Bangkok', clock_timestamp()))::int + 543;

  insert into private.receipt_counters(year_be,last_value)
  values(v_year,1)
  on conflict(year_be) do update set last_value=private.receipt_counters.last_value+1
  returning last_value into v_serial;
  v_number := 'KKC-RC-'||v_year::text||'-'||lpad(v_serial::text,6,'0');

  insert into public.payment_receipts (
    application_id,payment_id,receipt_number,year_be,amount,paid_at,issued_by,details
  ) values (
    v_application.id,v_payment.id,v_number,v_year,v_payment.amount,v_payment.paid_at,auth.uid(),
    jsonb_build_object(
      'issuer',coalesce(nullif(btrim(v_issuer),''),'มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น'),
      'payer',v_name,
      'job_title',v_job.title,
      'department',coalesce(v_department,''),
      'application_number',coalesce(v_application.application_number,''),
      'payment_reference',coalesce(v_payment.reference,''),
      'bank_name',coalesce(v_bank->>'bank_name',''),
      'account_name',coalesce(v_bank->>'account_name',''),
      'account_number',coalesce(v_bank->>'account_number','')
    )
  );

  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'payment_receipt',v_payment.id,'issued',
    jsonb_build_object('receipt_number',v_number,'payment_id',v_payment.id));
  perform private.notify(v_application.user_id,v_application.id,
    'ออกใบรับชำระเงินแล้ว',
    'เจ้าหน้าที่ตรวจสอบและยืนยันการรับชำระเงินแล้ว เลขที่เอกสาร '||v_number||
    ' สามารถดาวน์โหลด PDF ได้จากใบสมัครของฉัน',
    'payment-receipt:'||v_payment.id::text);
  return v_number;
end
$function$
;

CREATE OR REPLACE FUNCTION private.review_payment(p_id uuid, p_confirm boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.payment_records;
begin
 if not private.can('payments') then raise exception 'FORBIDDEN'; end if;
 select * into p from public.payment_records where id=p_id for update;
 if p.id is null or p.status<>'pending' then raise exception 'PAYMENT_LOCKED'; end if;
 if not p_confirm and coalesce(trim(p_reason),'')='' then raise exception 'REASON_REQUIRED'; end if;
 if exists(select 1 from public.payment_records where application_id=p.application_id and created_at>p.created_at) then raise exception 'STALE_PAYMENT'; end if;

 update public.payment_records
 set status=case when p_confirm then 'confirmed'::public.payment_state else 'rejected'::public.payment_state end,
 reason=left(coalesce(p_reason,''),2000),reviewed_by=auth.uid(),reviewed_at=clock_timestamp()
 where id=p_id;
 update public.applications
 set payment_status=case when p_confirm then 'confirmed'::public.payment_state else 'rejected'::public.payment_state end
 where id=p.application_id;
 insert into public.audit_logs(actor_id,entity,entity_id,action)
 values(auth.uid(),'payment',p_id,case when p_confirm then 'confirmed' else 'rejected' end);
 if p_confirm then
   perform private.issue_payment_receipt(p_id);
 end if;
 perform private.notify((select user_id from public.applications where id=p.application_id),
   p.application_id,'ผลตรวจหลักฐานชำระเงิน',
   case when p_confirm then 'ยืนยันการชำระเงินแล้ว' else 'กรุณาแก้ไข: '||p_reason end,
   'payment:'||p_id);
end
$function$
;
create trigger payment_receipt_no_modify before update or delete
on public.payment_receipts for each row execute function private.guard_payment_receipt();
create function public.admin_issue_payment_receipt(p_payment uuid)
returns text language sql set search_path to ''
as $wrapper$select private.issue_payment_receipt(p_payment);$wrapper$;
revoke all on function public.admin_issue_payment_receipt(uuid) from public, anon;
grant execute on function public.admin_issue_payment_receipt(uuid) to authenticated;
