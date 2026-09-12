export type PerfilAcesso =
  | 'admin'
  | 'cadastro'
  | 'manutencao'
  | 'verificacoes'
  | 'financeiro'
  | 'juridico';

export type StatusDistrato =
  | 'Em Aberto'
  | 'Em Auditoria'
  | 'Aguardando Emissão'
  | 'Distrato Emitido'
  | 'Em Cobrança'
  | 'Quitado'
  | 'Em Protesto'
  | 'Ajuizado'
  | 'Cancelado';

export type StatusVerificacao =
  | 'Aguardando análise'
  | 'Em análise'
  | 'Sem pendências'
  | 'Pendência encontrada'
  | 'Concluída';

export type StatusFinanceiro =
  | 'Aguardando boleto'
  | 'Boleto emitido'
  | 'A vencer'
  | 'Vencido'
  | 'Parcialmente pago'
  | 'Quitado'
  | 'Em negociação'
  | 'Encaminhado para protesto'
  | 'Em processo judicial';

export type TipoDistrato = 'Cavalo' | 'Carreta' | 'Cavalo e Carreta';

export type TipoVerificacao =
  | 'manutencao'
  | 'sinistro'
  | 'perda_carga'
  | 'multas'
  | 'abastecimento'
  | 'estadia'
  | 'camera_rastreador'
  | 'estacionamento'
  | 'pneus'
  | 'antt'
  | 'suprimentos';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilAcesso;
  departamento: string;
  cargo: string;
  avatar?: string;
}

export interface Agregado {
  id: string;
  nome: string;
  codigo: string;
  documento: string;
  telefone: string;
  email: string;
  chavePix?: string;
  banco?: string;
}

export interface Veiculo {
  id: string;
  placaCavalo: string;
  placaCarreta: string;
  modeloCavalo?: string;
  anoCavalo?: number;
  renavamCavalo?: string;
  proprietario?: string;
}

export interface Anexo {
  id: string;
  nome: string;
  tipo: string;
  url?: string;
  tamanhoKb: number;
  dataUpload: string;
  usuarioId: string;
  usuarioNome: string;
  categoria?: string;
}

export interface Verificacao {
  id: string;
  tipo: TipoVerificacao;
  titulo: string;
  descricao: string;
  status: StatusVerificacao;
  dataAuditoria: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  valor: number; // valor monetário numérico rigoroso
  observacoes: string;
  anexos: Anexo[];
  // Campos específicos
  sinistroDescricao?: string;
  perdaCargaDescricao?: string;
  multasAutos?: string;
  multasDataConferencia?: string;
  abastecimentoNumeroNF?: string;
  abastecimentoDataConferencia?: string;
  estadiaDataConferencia?: string;
  cameraValor?: number;
  rastreadorValor?: number;
  cameraRastreadorDataConferencia?: string;
  estacionamentoDataConferencia?: string;
  pneusObservacao?: string;
  anttStatus?: 'Pendente' | 'Protocolado' | 'Desvinculado';
  anttData?: string;
  suprimentosResultado?: 'Conforme' | 'Inconforme' | 'Pendente';
  suprimentosData?: string;
}

export interface Pagamento {
  id: string;
  distratoId: string;
  data: string;
  valor: number;
  formaPagamento: 'Boleto Bancário' | 'PIX' | 'Transferência TED' | 'Compensação' | 'Outro';
  comprovanteNome?: string;
  comprovanteUrl?: string;
  usuarioId: string;
  usuarioNome: string;
  observacao?: string;
  cancelado: boolean;
  justificativaCancelamento?: string;
  dataCancelamento?: string;
  usuarioCancelamentoNome?: string;
}

export interface Boleto {
  id: string;
  distratoId: string;
  numeroDocumento: string;
  nossoNumero: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: number;
  status: 'A vencer' | 'Vencido' | 'Pago' | 'Protestado' | 'Cancelado';
  codigoBarras: string;
  linkPdf?: string;
}

export interface HistoricoAlteracao {
  id: string;
  distratoId: string;
  dataHora: string;
  usuarioId: string;
  usuarioNome: string;
  perfil: PerfilAcesso;
  campoAlterado: string;
  valorAnterior: string;
  valorNovo: string;
  justificativa?: string;
}

export interface Distrato {
  id: string; // ex: "DIS-2025-001"
  agregadoId: string;
  agregadoNome: string;
  agregadoCodigo: string;
  dataSolicitacao: string;
  statusTermoAgregacao: 'Ativo' | 'Suspenso' | 'Em Encerramento' | 'Rescindido';
  placaCavalo: string;
  placaCarreta: string;
  debitoAluguel: number;
  gridOperacao: string;
  segmento: string;
  tipoDistrato: TipoDistrato;
  responsavelAtualId: string;
  responsavelAtualNome: string;
  statusGeral: StatusDistrato;
  statusFinanceiro: StatusFinanceiro;
  dataCriacao: string;
  dataUltimaAtualizacao: string;

  // Emissão e cobrança
  dataEmissaoDistrato?: string;
  dataEnvioAgregado?: string;
  formaPagamento?: string;
  solicitouEmissaoBoleto: boolean;
  dataSolicitacaoBoleto?: string;
  dataEmissaoBoleto?: string;
  dataVencimentoBoleto?: string;
  observacoesFinanceiras?: string;

  // Fluxo Jurídico
  docsConferidosProtesto: boolean;
  docsConferidosData?: string;
  docsConferidosUsuario?: string;
  encaminhadoProtesto: boolean;
  dataEnvioProtesto?: string;
  dataEfetivacaoProtesto?: string;
  boletoProtestadoNumero?: string;
  cartorioProtesto?: string;
  custasCartorio?: number;
  encaminhadoAjuizamento: boolean;
  dataAjuizamento?: string;
  numeroProcessoJudicial?: string;
  varaComarca?: string;
  valorAcaoJudicial?: number;
  resultadoNegativa?: string;
  observacoesJuridicas?: string;

  // Sub-entidades
  verificacoes: Verificacao[];
  pagamentos: Pagamento[];
  boletos: Boleto[];
  documentos: Anexo[];
  historico: HistoricoAlteracao[];
}

export interface Notificacao {
  id: string;
  distratoId?: string;
  tipo:
    | 'atribuicao'
    | 'prazo'
    | 'atraso'
    | 'emissao'
    | 'vencimento'
    | 'vencido'
    | 'pagamento'
    | 'quitacao'
    | 'protesto'
    | 'ajuizamento';
  titulo: string;
  mensagem: string;
  dataHora: string;
  lida: boolean;
  perfilDestino?: PerfilAcesso | 'todos';
  linkDistratoId?: string;
}

export interface FiltrosDistrato {
  busca: string;
  statusGeral: string;
  statusFinanceiro: string;
  segmento: string;
  responsavel: string;
  dataInicio: string;
  dataFim: string;
  tipoDistrato: string;
}
