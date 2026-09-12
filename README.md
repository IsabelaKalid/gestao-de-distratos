# Gestão de Distratos — Agregados e Veículos

Sistema React conectado ao Supabase, com cadastro por e-mail e senha, aprovação administrativa e dados compartilhados.

## Configuração

1. Crie um projeto gratuito em https://supabase.com.
2. Abra o SQL Editor e execute `supabase/schema.sql`.
3. Em Authentication > Providers > Email, mantenha Email habilitado.
4. Copie `.env.example` para `.env` e preencha a URL e a chave pública anon do projeto.
5. Execute `npm install` e `npm run dev`.
6. Crie sua conta pela tela do sistema e confirme o e-mail.
7. No SQL Editor, promova sua conta:

```sql
update public.profiles
set perfil='admin', aprovado=true, ativo=true
where email='SEU_EMAIL';
```

8. Entre novamente. Em Administração, use “Importar dados iniciais”.
9. Novos funcionários podem se cadastrar normalmente. O administrador define perfil, departamento e aprovação.

## Publicação

O projeto gera frontend estático com `npm run build`; a pasta de saída é `dist`. Cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` como variáveis na hospedagem.

## Segurança

- Nunca exponha a chave `service_role` no frontend.
- O banco usa Row Level Security.
- Novas contas começam como `pendente` e sem aprovação.
- O menu administrativo aparece somente para administradores.

## Estrutura desta primeira migração

Para preservar todas as telas e regras atuais, cada distrato é salvo como um documento JSONB individual na tabela `distratos`. Isso já elimina o `localStorage` como fonte oficial e permite que todos trabalhem na mesma base. Uma evolução futura pode separar pagamentos, verificações, documentos e histórico em tabelas próprias para controles mais granulares.
