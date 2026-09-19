import { Verificacao, TipoVerificacao } from '../types';

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
