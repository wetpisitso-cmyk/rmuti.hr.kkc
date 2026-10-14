create or replace function private.publish_results(p_job uuid,p_kind text,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; v_id uuid;
begin
 if not private.can('publish') then raise exception 'FORBIDDEN'; end if;
 if p_kind not in ('eligibility','selection') then raise exception 'INVALID_INPUT'; end if;
 if p_kind='selection' then
  select coalesce(jsonb_agg(jsonb_build_object('number',a.application_number,'name',concat_ws(' ',a.snapshot->'personal'->>'first_name',a.snapshot->'personal'->>'last_name'),'outcome',s.outcome) order by a.application_number),'[]') into v_rows
  from public.applications a join public.selection_results s on s.application_id=a.id where a.job_id=p_job;
  update public.selection_results set published=true where application_id in (select id from public.applications where job_id=p_job);
 else
  select coalesce(jsonb_agg(jsonb_build_object('number',a.application_number,'name',concat_ws(' ',a.snapshot->'personal'->>'first_name',a.snapshot->'personal'->>'last_name'),'outcome',a.status) order by a.application_number),'[]') into v_rows
  from public.applications a where a.job_id=p_job and a.status in ('eligible','ineligible');
 end if;
 if jsonb_array_length(v_rows)=0 then raise exception 'EMPTY_RESULTS'; end if;
 insert into public.published_results(job_id,title,kind,rows,approved_by) values(p_job,p_title,p_kind,v_rows,auth.uid())
 on conflict(job_id,kind) do update set title=excluded.title,rows=excluded.rows,approved_by=excluded.approved_by,published_at=now() returning id into v_id;
 insert into public.audit_logs(actor_id,entity,entity_id,action) values(auth.uid(),'published_results',v_id,'publish');
 return v_id;
end $$;
