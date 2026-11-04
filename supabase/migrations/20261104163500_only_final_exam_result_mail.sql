-- Only final selection results generate the final-exam-result email.
-- Qualification publications have their own eligible/ineligible notifications.
create or replace function private.selection_publication_mail_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_app record;
begin
  if new.kind <> 'selection' then return new; end if;
  if tg_op='UPDATE' and old.published_at is not distinct from new.published_at
    and old.rows is not distinct from new.rows then return new; end if;
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
