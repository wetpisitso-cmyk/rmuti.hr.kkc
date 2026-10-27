create or replace function public.exam_card_round_status(p_round uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if not private.can('exams') then raise exception 'FORBIDDEN'; end if;
 select jsonb_build_object(
  'issue_label',coalesce(cfg.issue_label,'ครั้งที่ 40 / 2569'),
  'rules_approved',coalesce(cfg.rules_approved_at is not null
      and cfg.rules_version='original-20261027-v1',false)
 ) into v
 from public.recruitment_rounds r
 left join public.exam_card_round_settings cfg on cfg.round_id=r.id
 where r.id=p_round;
 if v is null then raise exception 'ROUND_NOT_FOUND'; end if;
 return v;
end $$;
revoke all on function public.exam_card_round_status(uuid) from public,anon;
grant execute on function public.exam_card_round_status(uuid) to authenticated;
