-- Execute uma vez no SQL Editor do Supabase antes de publicar esta versão.
create or replace function public.atualizar_perfil_supervisor(
  p_id uuid,
  p_perfil text,
  p_departamento text,
  p_cargo text,
  p_aprovado boolean,
  p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usuario_admin() then
    raise exception 'Somente supervisores podem alterar usuários'
      using errcode = '42501';
  end if;

  if p_perfil not in ('pendente','admin','cadastro','manutencao','verificacoes','financeiro','juridico') then
    raise exception 'Perfil de acesso inválido'
      using errcode = '22023';
  end if;

  update public.profiles
  set perfil = p_perfil::public.perfil_acesso,
      departamento = trim(coalesce(p_departamento, '')),
      cargo = trim(coalesce(p_cargo, '')),
      aprovado = p_aprovado,
      ativo = p_ativo,
      atualizado_em = now()
  where id = p_id;

  if not found then
    raise exception 'Usuário não encontrado'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.atualizar_perfil_supervisor(uuid,text,text,text,boolean,boolean) from public;
grant execute on function public.atualizar_perfil_supervisor(uuid,text,text,text,boolean,boolean) to authenticated;
