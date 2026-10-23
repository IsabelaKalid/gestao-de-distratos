-- Execute uma única vez no SQL Editor do projeto no Supabase.
-- Preserva somente os distratos confirmados abaixo e não altera usuários/perfis.

begin;

delete from public.notificacoes
where coalesce(dados->>'distratoId', dados->>'linkDistratoId', '') <> ''
  and coalesce(dados->>'distratoId', dados->>'linkDistratoId') not in (
    'DIS-2026-050',
    'DIS-2026-051',
    'DIS-2026-053'
  );

delete from public.distratos
where id not in (
  'DIS-2026-050',
  'DIS-2026-051',
  'DIS-2026-053'
);

commit;

-- Conferência: o resultado esperado é exatamente 3 linhas.
select id, dados->>'agregadoNome' as agregado
from public.distratos
order by id;
