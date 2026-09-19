-- Execute uma vez no SQL Editor do projeto Transpanorama.
-- A exclusão continua restrita ao perfil supervisor (valor interno: admin).

grant delete on table public.distratos to authenticated;
grant delete on table public.notificacoes to authenticated;

drop policy if exists "administradores excluem distratos" on public.distratos;
create policy "administradores excluem distratos"
on public.distratos for delete to authenticated
using (public.usuario_admin());

drop policy if exists "administradores excluem notificacoes" on public.notificacoes;
create policy "administradores excluem notificacoes"
on public.notificacoes for delete to authenticated
using (public.usuario_admin());
