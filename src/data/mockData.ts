import { Distrato, Usuario, Notificacao, Verificacao, TipoVerificacao } from '../types';
import { USUARIOS_TRANSPANORAMA, gerarDistratosTranspanorama } from './transpanoramaData';

export const USUARIOS_INICIAIS: Usuario[] = USUARIOS_TRANSPANORAMA;

export function criarVerificacoesPadrao(distratoId: string): Verificacao[] {
  const lista: { tipo: TipoVerificacao; titulo: string; descricao: string }[] = [
    { tipo: 'manutencao', titulo: 'Manutenção Mecânica', descricao: 'Avaliação de integridade mecânica, motor, freios e suspensão' },
    { tipo: 'sinistro', titulo: 'Sinistros e Avarias', descricao: 'Levantamento de colisões, tombamentos e avarias em trânsito' },
    { tipo: 'perda_carga', titulo: 'Perda de Carga', descricao: 'Conferência de relatórios de avaria ou extravio de mercadorias' },
    { tipo: 'multas', titulo: 'Multas de Trânsito', descricao: 'Consulta em órgãos de trânsito (PRF, Detrans, DER, DNIT)' },
    { tipo: 'abastecimento', titulo: 'Abastecimento / Postos', descricao: 'Conciliação de saldos em cartões de combustível e notas faturadas' },
    { tipo: 'estadia', titulo: 'Estadia e Diárias', descricao: 'Auditoria de valores adiantados ou cobrados indevidamente de estadias' },
    { tipo: 'camera_rastreador', titulo: 'Câmera e Rastreador', descricao: 'Conferência de equipamentos de telemetria, antenas e câmeras de bordo' },
    { tipo: 'estacionamento', titulo: 'Estacionamento & Pátio', descricao: 'Despesas acumuladas de pátios terceirizados e diárias de garagem' },
    { tipo: 'pneus', titulo: 'Auditoria de Pneus', descricao: 'Medição de sulcos, contagem de carcaças e conferência de marcas instaladas' },
    { tipo: 'antt', titulo: 'Desvinculação da ANTT', descricao: 'Validação da baixa do RNTRC e termo de desvinculação junto à ANTT' },
    { tipo: 'suprimentos', titulo: 'Auditoria de Suprimentos', descricao: 'Devolução de EPIs, kit de amarração de carga, lona e cantoneiras' },
  ];

  return lista.map((item, idx) => ({
    id: `ver-${distratoId}-${idx + 1}`,
    tipo: item.tipo,
    titulo: item.titulo,
    descricao: item.descricao,
    status: 'Aguardando análise',
    dataAuditoria: null,
    responsavelId: null,
    responsavelNome: null,
    valor: 0,
    observacoes: '',
    anexos: [],
  }));
}

export const DISTRATOS_INICIAIS: Distrato[] = gerarDistratosTranspanorama();

export const NOTIFICACOES_INICIAIS: Notificacao[] = [
  {
    id: 'notif-1',
    tipo: 'atraso',
    titulo: 'Boleto Vencido - Cobrança & Protesto',
    mensagem: 'O distrato DIS-2026-035 (2G AUTO HOLDING) está com boleto de R$ 6.865,93 vencido (venc. 15/05/2026).',
    dataHora: '2026-05-16T08:00:00Z',
    lida: false,
    perfilDestino: 'financeiro',
    linkDistratoId: 'DIS-2026-035',
  },
  {
    id: 'notif-2',
    tipo: 'protesto',
    titulo: 'Encaminhamento a Cartório',
    mensagem: 'Processo DIS-2026-035 com documentação validada para envio ao 1º Tabelionato de Notas e Protestos de Maringá.',
    dataHora: '2026-05-18T14:30:00Z',
    lida: false,
    perfilDestino: 'juridico',
    linkDistratoId: 'DIS-2026-035',
  },
  {
    id: 'notif-3',
    tipo: 'pagamento',
    titulo: 'Acordo Parcelado em Andamento',
    mensagem: 'Distrato DIS-2026-016 (TRANSPORTADORA DFS) possui R$ 6.859,59 quitados e saldo restante de R$ 4.744,15.',
    dataHora: '2026-02-26T10:00:00Z',
    lida: true,
    perfilDestino: 'financeiro',
    linkDistratoId: 'DIS-2026-016',
  },
  {
    id: 'notif-4',
    tipo: 'atribuicao',
    titulo: 'Pendência de Manutenção de Pátio',
    mensagem: 'Distrato DIS-2026-023 (MAXXI TRANSPORTE) possui saldo pendente de oficina no valor de R$ 1.714,65.',
    dataHora: '2026-03-07T09:15:00Z',
    lida: true,
    perfilDestino: 'manutencao',
    linkDistratoId: 'DIS-2026-023',
  },
];
