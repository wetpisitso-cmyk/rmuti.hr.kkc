-- Admin-managed bank transfer settings and public payment QR assets.
-- Applied to the connected project; preserve as source of truth for new installs.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('recruitment-payment-qr','recruitment-payment-qr',true,1048576,array['image/png','image/jpeg'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy payment_qr_admin_select on storage.objects for select to authenticated
using(bucket_id='recruitment-payment-qr' and (select private.can('admin')));
create policy payment_qr_admin_insert on storage.objects for insert to authenticated
with check(bucket_id='recruitment-payment-qr' and (select private.can('admin')) and name ~ '^qr/[a-f0-9-]{36}\\.(png|jpg|jpeg)$');
create policy payment_qr_admin_update on storage.objects for update to authenticated
using(bucket_id='recruitment-payment-qr' and (select private.can('admin')))
with check(bucket_id='recruitment-payment-qr' and (select private.can('admin')) and name ~ '^qr/[a-f0-9-]{36}\\.(png|jpg|jpeg)$');
create policy payment_qr_admin_delete on storage.objects for delete to authenticated
using(bucket_id='recruitment-payment-qr' and (select private.can('admin')));

CREATE OR REPLACE FUNCTION private.save_setting(p_key text, p_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_value jsonb := p_value;
  v_path text;
begin
  if not private.can('admin') then raise exception 'FORBIDDEN'; end if;
  if p_key not in ('contact','privacy','retention','payment')
     or jsonb_typeof(p_value) <> 'object'
     or length(p_value::text) > 20000 then
    raise exception 'INVALID_INPUT';
  end if;

  if p_key = 'payment' then
    v_path := nullif(btrim(coalesce(p_value->>'qr_path','')), '');
    if length(btrim(coalesce(p_value->>'bank_name',''))) not between 2 and 100
       or length(btrim(coalesce(p_value->>'account_name',''))) not between 2 and 160
       or btrim(coalesce(p_value->>'account_number','')) !~ '^[0-9][0-9 -]{5,29}$'
       or length(coalesce(p_value->>'note','')) > 500
       or (v_path is not null and v_path !~ '^qr/[a-f0-9-]{36}\.(png|jpg|jpeg)$')
    then
      raise exception 'INVALID_PAYMENT_SETTINGS';
    end if;
    v_value := jsonb_build_object(
      'bank_name', btrim(p_value->>'bank_name'),
      'account_name', btrim(p_value->>'account_name'),
      'account_number', btrim(p_value->>'account_number'),
      'qr_path', coalesce(v_path,''),
      'note', left(coalesce(p_value->>'note',''), 500)
    );
    if v_path is not null and not exists(
      select 1 from storage.objects where bucket_id='recruitment-payment-qr' and name=v_path
    ) then raise exception 'PAYMENT_QR_NOT_FOUND'; end if;
  end if;

  insert into public.app_settings(key,value) values(p_key,v_value)
  on conflict (key) do update set value=excluded.value,updated_at=now();
  insert into public.audit_logs(actor_id,entity,action,metadata)
  values(auth.uid(),'app_settings','save',jsonb_build_object('key',p_key));
end
$function$
;
