-- Patch 16: admin pode resetar o dispositivo vinculado de um usuário,
-- liberando para vincular em outro aparelho (mesmo padrão de admin_set_ban).

create or replace function public.admin_reset_device(target_user uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas admin pode resetar dispositivo';
  end if;
  update public.profiles
     set device_fingerprint = null,
         device_name = null
   where id = target_user;
end;
$$;

revoke all on function public.admin_reset_device from public;
grant execute on function public.admin_reset_device to authenticated;
