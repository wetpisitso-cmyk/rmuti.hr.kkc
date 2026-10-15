-- Admin-only handwritten approval of eligible applications.
-- The drawing is an authenticated acknowledgement image, NOT a cryptographic PDF signature.
create table if not exists public.application_admin_signatures (
  application_id uuid primary key references public.applications(id) on delete cascade,
  signer_id uuid not null references auth.users(id) on delete restrict,
  signature_png text not null check (length(signature_png) between 400 and 180000),
  signed_at timestamptz not null default now(),
  application_number_at_signing text not null,
  signed_snapshot_md5 text not null
);

alter table public.application_admin_signatures enable row level security;
revoke all on table public.application_admin_signatures from public, anon, authenticated;
grant select on table public.application_admin_signatures to authenticated;
create policy signature_read_by_owner_or_staff
on public.application_admin_signatures
for select to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);

create or replace function public.admin_sign_application(p_id uuid, p_signature_png text, p_confirm boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_payload text;
  v_bytes bytea;
  v_at timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ) then raise exception 'FORBIDDEN'; end if;

  if p_confirm is distinct from true then raise exception 'SIGNATURE_CONFIRMATION_REQUIRED'; end if;
  select * into v_app from public.applications where id = p_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if v_app.status <> 'eligible'
     or v_app.submitted_at is null
     or v_app.application_number is null
     or v_app.payment_status not in ('confirmed','not_required')
  then raise exception 'APPLICATION_NOT_ELIGIBLE_FOR_SIGNATURE'; end if;

  if exists(select 1 from public.application_admin_signatures where application_id = p_id) then
    raise exception 'APPLICATION_ALREADY_SIGNED';
  end if;

  if p_signature_png is null or length(p_signature_png) not between 400 and 180000
     or p_signature_png !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
  then raise exception 'INVALID_SIGNATURE_IMAGE'; end if;

  v_payload := split_part(p_signature_png, ',', 2);
  begin
    v_bytes := decode(v_payload, 'base64');
  exception when others then
    raise exception 'INVALID_SIGNATURE_IMAGE';
  end;
  if octet_length(v_bytes) not between 300 and 120000
     or substring(v_bytes from 1 for 8) <> decode('89504e470d0a1a0a','hex')
  then raise exception 'INVALID_SIGNATURE_IMAGE'; end if;

  insert into public.application_admin_signatures (
    application_id, signer_id, signature_png, application_number_at_signing, signed_snapshot_md5
  ) values (
    p_id, auth.uid(), p_signature_png, v_app.application_number, md5(coalesce(v_app.snapshot::text,''))
  )
  returning signed_at into v_at;

  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values (auth.uid(), 'applications', p_id, 'admin_signed',
     jsonb_build_object('application_number',v_app.application_number,'signed_at',v_at));

  perform private.notify(v_app.user_id,p_id,'เจ้าหน้าที่รับรองใบสมัครแล้ว',
    'แอดมินได้ลงลายเซ็นรับรองใบสมัครเลขที่ '||v_app.application_number||
    ' แล้ว สามารถดูได้ในใบสมัคร PDF',
    'admin-signature:'||p_id::text);

  return jsonb_build_object('signed',true,'signed_at',v_at,'application_number',v_app.application_number);
end;
$$;

revoke all on function public.admin_sign_application(uuid,text,boolean) from public, anon;
grant execute on function public.admin_sign_application(uuid,text,boolean) to authenticated;
