-- Prevent repeated payment submissions and reapproval. Already applied to production.

CREATE OR REPLACE FUNCTION private.review_payment(p_id uuid, p_confirm boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.payment_records;
  a public.applications;
begin
 if not private.can('payments') then raise exception 'FORBIDDEN'; end if;
 select * into p from public.payment_records where id=p_id for update;
 if p.id is null or p.status<>'pending' then raise exception 'PAYMENT_LOCKED'; end if;
 select * into a from public.applications where id=p.application_id for update;
 if a.id is null or a.payment_status='confirmed'
   or exists(select 1 from public.payment_receipts where application_id=p.application_id)
 then raise exception 'PAYMENT_ALREADY_CONFIRMED'; end if;
 if not p_confirm and coalesce(trim(p_reason),'')='' then raise exception 'REASON_REQUIRED'; end if;
 if exists(select 1 from public.payment_records
           where application_id=p.application_id
             and (created_at>p.created_at or (created_at=p.created_at and id>p.id)))
 then raise exception 'STALE_PAYMENT'; end if;
 update public.payment_records
 set status=case when p_confirm then 'confirmed'::public.payment_state else 'rejected'::public.payment_state end,
     reason=left(coalesce(p_reason,''),2000),
     reviewed_by=auth.uid(),reviewed_at=clock_timestamp()
 where id=p_id;
 update public.applications
 set payment_status=case when p_confirm then 'confirmed'::public.payment_state else 'rejected'::public.payment_state end
 where id=p.application_id;
 insert into public.audit_logs(actor_id,entity,entity_id,action)
 values(auth.uid(),'payment',p_id,case when p_confirm then 'confirmed' else 'rejected' end);
 if p_confirm then
   perform private.issue_payment_receipt(p_id);
 end if;
 perform private.notify(a.user_id,p.application_id,'ผลตรวจหลักฐานชำระเงิน',
   case when p_confirm then 'ยืนยันการชำระเงินแล้ว' else 'กรุณาแก้ไข: '||p_reason end,
   'payment:'||p_id);
end $function$
;

CREATE OR REPLACE FUNCTION private.save_payment(p_app uuid, p_amount numeric, p_paid timestamp with time zone, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.applications;
  j public.job_positions;
  d uuid;
  v_path text;
  v_id uuid;
  v_ref text;
begin
  select * into a from public.applications where id=p_app and user_id=auth.uid() for update;
  if a.id is null then raise exception 'FORBIDDEN'; end if;
  select * into j from public.job_positions where id=a.job_id;
  if j.fee_amount<=0 or a.payment_status='confirmed' or a.status in ('ineligible','withdrawn')
     or exists(select 1 from public.payment_receipts where application_id=a.id)
  then raise exception 'PAYMENT_LOCKED'; end if;
  if p_amount<>j.fee_amount or p_paid is null or p_paid>now() or p_paid<now()-interval '1 year'
  then raise exception 'INVALID_PAYMENT'; end if;

  select id,storage_path into d,v_path
  from public.application_documents where application_id=a.id and document_type='payment';
  if d is null then raise exception 'DOCUMENTS_REQUIRED'; end if;

  select id into v_id from public.payment_records
  where application_id=a.id and slip_path=v_path and status in ('pending','confirmed')
  order by created_at desc,id desc limit 1;
  if v_id is not null then return v_id; end if;

  v_ref=nullif(trim(left(p_reference,100)),'');
  insert into public.payment_records(application_id,document_id,slip_path,amount,paid_at,reference)
  values(a.id,d,v_path,p_amount,p_paid,v_ref) returning id into v_id;
  update public.applications set payment_status='pending',updated_at=clock_timestamp() where id=a.id;
  return v_id;
end $function$
;
