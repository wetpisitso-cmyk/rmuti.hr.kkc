-- Synced with deployed migration. Qualification approval precedes number assignment.
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
  -- Passing qualification is recorded at step 4; the application number is assigned in step 5.
  -- Signing and PDF approval still require a number and confirmed payment.
  if p_status='eligible' and a.payment_status not in ('not_required','confirmed') then raise exception 'PAYMENT_REQUIRED'; end if;
 end if;
 update public.applications set status=p_status,public_message=left(coalesce(p_message,''),2000),
 correction_deadline=case when p_status='needs_correction' then p_deadline end,updated_at=clock_timestamp() where id=p_id;
end $function$
;
