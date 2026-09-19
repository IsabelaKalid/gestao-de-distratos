-- Execute este arquivo uma única vez no SQL Editor do Supabase.
create type public.perfil_acesso as enum ('admin','pendente','cadastro','manutencao','verificacoes','financeiro','juridico');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  perfil public.perfil_acesso not null default 'pendente',
  departamento text not null default '',
  cargo text not null default '',
  avatar_url text,
  aprovado boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.distratos (
  id text primary key,
  dados jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.notificacoes (
  id text primary key,
  dados jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id,nome,email)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nome'),''),new.email),new.email);
  return new;
end; $$;

create trigger ao_criar_usuario after insert on auth.users
for each row execute function public.criar_perfil_usuario();

create or replace function public.usuario_aprovado()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and aprovado and ativo);
$$;

create or replace function public.usuario_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and perfil='admin' and aprovado and ativo);
$$;

alter table public.profiles enable row level security;
alter table public.distratos enable row level security;
alter table public.notificacoes enable row level security;

grant usage on schema public to anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.distratos to authenticated;
grant select, insert, update, delete on table public.notificacoes to authenticated;

create policy "perfil proprio ou administracao" on public.profiles for select to authenticated
using (id=auth.uid() or public.usuario_admin());
create policy "administrador atualiza perfis" on public.profiles for update to authenticated
using (public.usuario_admin()) with check (public.usuario_admin());

create policy "aprovados consultam distratos" on public.distratos for select to authenticated
using (public.usuario_aprovado());
create policy "aprovados criam distratos" on public.distratos for insert to authenticated
with check (public.usuario_aprovado());
create policy "aprovados atualizam distratos" on public.distratos for update to authenticated
using (public.usuario_aprovado()) with check (public.usuario_aprovado());
create policy "administradores excluem distratos" on public.distratos for delete to authenticated
using (public.usuario_admin());

create policy "aprovados consultam notificacoes" on public.notificacoes for select to authenticated
using (public.usuario_aprovado());
create policy "aprovados criam notificacoes" on public.notificacoes for insert to authenticated
with check (public.usuario_aprovado());
create policy "aprovados atualizam notificacoes" on public.notificacoes for update to authenticated
using (public.usuario_aprovado()) with check (public.usuario_aprovado());
create policy "administradores excluem notificacoes" on public.notificacoes for delete to authenticated
using (public.usuario_admin());

create index distratos_updated_at_idx on public.distratos(updated_at desc);
create index profiles_perfil_idx on public.profiles(perfil);

-- Depois de criar sua conta pela tela do sistema, execute uma vez,
-- trocando o e-mail abaixo pelo seu e-mail verdadeiro:
-- update public.profiles
-- set perfil='admin', aprovado=true, ativo=true
-- where email='seu-email@empresa.com.br';
