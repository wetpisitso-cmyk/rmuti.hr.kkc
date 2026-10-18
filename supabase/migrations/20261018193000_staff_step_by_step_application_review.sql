-- Manual checkmarks for staged HR review; separate from approval and payment confirmation.
create table public.application_review_steps (
 application_id uuid not null references public.applications(id) on delete cascade,
 step text not null check(step in ('personal','documents')),
 checked_by uuid not null references auth.users(id),
 checked_at timestamptz not null default clock_timestamp(),
 primary key(application_id,step)
);
alter table public.application_review_steps enable row level security;
revoke all on public.application_review_steps from public,anon,authenticated;
grant select on public.application_review_steps to authenticated;
create policy "staff_review_steps_read" on public.application_review_steps
for select to authenticated using ((select private.is_staff()));
create function public.staff_mark_review_step(p_id uuid,p_step text,p_done boolean)
returns void language plpgsql security definer set search_path to ''
as $review_step$
declare v_app public.applications;
begin
 if not private.can('review') then raise exception 'FORBIDDEN'; end if;
 if p_step not in ('personal','documents') or p_done is null then raise exception 'INVALID_INPUT'; end if;
 select * into v_app from public.applications where id=p_id for update;
 if v_app.id is null or v_app.submitted_at is null or v_app.status='draft' then raise exception 'APPLICATION_NOT_READY'; end if;
 if p_done and p_step='documents' and exists(
 select 1 from public.job_positions j,lateral jsonb_array_elements(j.required_documents) req
 where j.id=v_app.job_id and coalesce((req->>'required')::boolean,false)
 and not exists(select 1 from public.application_documents doc where doc.application_id=p_id and doc.document_type=req->>'key')
 ) then raise exception 'DOCUMENTS_REQUIRED'; end if;
 if p_done then
 insert into public.application_review_steps(application_id,step,checked_by,checked_at)
 values(p_id,p_step,auth.uid(),clock_timestamp())
 on conflict(application_id,step) do update set checked_by=excluded.checked_by,checked_at=excluded.checked_at;
 else delete from public.application_review_steps where application_id=p_id and step=p_step;
 end if;
 insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
 values(auth.uid(),'application_review',p_id,case when p_done then 'check' else 'uncheck' end,jsonb_build_object('step',p_step));
end $review_step$;
revoke all on function public.staff_mark_review_step(uuid,text,boolean) from public,anon;
grant execute on function public.staff_mark_review_step(uuid,text,boolean) to authenticated;
