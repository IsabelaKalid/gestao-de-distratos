-- Execute uma vez no SQL Editor do Supabase antes de publicar esta versão.
alter table public.profiles
add column if not exists departamentos text[] not null default '{}';

-- Preserva o departamento antigo como primeiro acesso da pessoa.
update public.profiles
set departamentos = array[departamento]
where coalesce(trim(departamento), '') <> ''
  and cardinality(departamentos) = 0;

-- Remove textos antigos que eram cargos, como "Chefe do Jurídico",
-- e mantém apenas departamentos reconhecidos pelo sistema.
update public.profiles p
set departamentos = coalesce((
  select array_agg(d)
  from unnest(p.departamentos) as d
  where d = any(array[
    'Logística','Oficina','Financeiro','Abastecimento','Multa',
    'Customer Service','Tecnologia Integrada','Estacionamento','Almoxarifado',
    'Auditoria','Auditoria de Suprimentos','Jurídico','Controladoria e Planejamento'
  ])
), '{}');

drop function if exists public.atualizar_perfil_supervisor(uuid,text,text,text,boolean,boolean);

create or replace function public.atualizar_perfil_supervisor(
  p_id uuid,
  p_perfil text,
  p_departamento text,
  p_departamentos text[],
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
    raise exception 'Perfil de acesso inválido' using errcode = '22023';
  end if;

  update public.profiles
  set perfil = p_perfil::public.perfil_acesso,
      departamento = trim(coalesce(p_departamento, '')),
      departamentos = coalesce(p_departamentos, '{}'),
      cargo = trim(coalesce(p_cargo, '')),
      aprovado = p_aprovado,
      ativo = p_ativo,
      atualizado_em = now()
  where id = p_id;

  if not found then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.atualizar_perfil_supervisor(uuid,text,text,text[],text,boolean,boolean) from public;
grant execute on function public.atualizar_perfil_supervisor(uuid,text,text,text[],text,boolean,boolean) to authenticated;
