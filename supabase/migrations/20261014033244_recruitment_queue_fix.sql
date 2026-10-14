create or replace function public.claim_emails(p_limit int default 10) returns table(id uuid,email text,subject text,body text,lease_token uuid,attempts int)
language plpgsql security definer set search_path='' as $$
begin
 update public.email_outbox q set status='failed',error_code='LEASE_EXHAUSTED' where q.status='processing' and q.lease_until<now() and q.attempts>=5;
 return query with todo as (select q.id from public.email_outbox q where q.attempts<5 and
 ((q.status='pending' and q.next_attempt_at<=now()) or (q.status='processing' and q.lease_until<now())) order by q.created_at for update skip locked limit least(greatest(p_limit,1),20)),
 claimed as (update public.email_outbox q set status='processing',attempts=q.attempts+1,lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid() from todo where q.id=todo.id returning q.*)
 select c.id,u.email::text,c.subject,c.body,c.lease_token,c.attempts from claimed c join auth.users u on u.id=c.user_id;
end $$;
