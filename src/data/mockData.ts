import { Verificacao, TipoVerificacao } from '../types';

export function criarVerificacoesPadrao(distratoId: string, debitoAluguel = 0): Verificacao[] {
  const lista: { tipo: TipoVerificacao; titulo: string; descricao: string }[] = [
    { tipo: 'aluguel_equipamento', titulo: 'Aluguel de Equipamento', descricao: 'Locação de carreta, equipamentos e valores adicionais vinculados' },
    { tipo: 'manutencao', titulo: 'Manutenção', descricao: 'Avaliação de integridade mecânica, motor, freios e suspensão' },
    { tipo: 'sinistro', titulo: 'Sinistros e Avarias', descricao: 'Levantamento de colisões, tombamentos e avarias em trânsito' },
    { tipo: 'perda_carga', titulo: 'Perda de Carga', descricao: 'Conferência de relatórios de avaria ou extravio de mercadorias' },
    { tipo: 'multas', titulo: 'Multas de Trânsito', descricao: 'Consulta em órgãos de trânsito (PRF, Detrans, DER, DNIT)' },
    { tipo: 'abastecimento', titulo: 'Abastecimento / Postos', descricao: 'Conciliação de saldos em cartões de combustível e notas faturadas' },
    { tipo: 'estadia', titulo: 'Estadia', descricao: 'Conferência de valores relacionados à estadia' },
    { tipo: 'camera_rastreador', titulo: 'Câmera e Rastreador', descricao: 'Conferência de equipamentos de telemetria, antenas e câmeras de bordo' },
    { tipo: 'estacionamento', titulo: 'Estacionamento', descricao: 'Despesas de estacionamento vinculadas ao veículo' },
    { tipo: 'pneus', titulo: 'Pneus', descricao: 'Quantidade, valor unitário e conferência dos pneus' },
    { tipo: 'antt', titulo: 'Desvinculação da ANTT', descricao: 'Validação da baixa do RNTRC e termo de desvinculação junto à ANTT' },
    { tipo: 'suprimentos', titulo: 'Auditoria de Suprimentos', descricao: 'Devolução de EPIs, kit de amarração de carga, lona e cantoneiras' },
  ];

  return lista.map((item, idx) => ({
    id: `ver-${distratoId}-${idx + 1}`,
    tipo: item.tipo,
    titulo: item.titulo,
    descricao: item.descricao,
    status: item.tipo === 'aluguel_equipamento' && debitoAluguel > 0 ? 'Pendência encontrada' : 'Aguardando análise',
    dataAuditoria: null,
    responsavelId: null,
    responsavelNome: null,
    valor: item.tipo === 'aluguel_equipamento' ? debitoAluguel : 0,
    observacoes: '',
    anexos: [],
    lancamentos: item.tipo === 'aluguel_equipamento' && debitoAluguel > 0
      ? [{
          id: `lanc-${distratoId}-aluguel-inicial`,
          data: new Date().toISOString().slice(0, 10),
          valor: debitoAluguel,
          observacoes: 'Aluguel inicial de equipamento',
          responsavelCusto: 'Agregado',
          anexos: [],
          usuarioId: 'sistema',
          usuarioNome: 'Cadastro do distrato',
          criadoEm: new Date().toISOString(),
        }]
      : [],
  }));
}
