// Dados da empresa exibidos no sistema. Configure no .env para não expor no repositório.
const env = import.meta.env;

export const EMPRESA = {
  nome: env.VITE_EMPRESA_NOME || "Distravia",
  razaoSocial: env.VITE_EMPRESA_RAZAO_SOCIAL || env.VITE_EMPRESA_NOME || "Distravia Gestão de Frotas Ltda.",
  dadosCadastrais: env.VITE_EMPRESA_DADOS_CADASTRAIS || "",
};
