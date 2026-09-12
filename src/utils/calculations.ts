import { Distrato, StatusFinanceiro, StatusDistrato } from '../types';

/**
 * Formata um número para o padrão monetário brasileiro: R$ 14.650,65
 */
export function formatarMoeda(valor: number | null | undefined): string {
  const num = typeof valor === 'number' && !isNaN(valor) ? valor : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formata data ISO para DD/MM/AAAA
 */
export function formatarData(dataIso?: string | null): string {
  if (!dataIso) return '-';
  try {
    const [ano, mes, dia] = dataIso.split('T')[0].split('-');
    if (ano && mes && dia) {
      return `${dia}/${mes}/${ano}`;
    }
    return new Date(dataIso).toLocaleDateString('pt-BR');
  } catch {
    return dataIso;
  }
}

/**
 * Formata data e hora para DD/MM/AAAA às HH:mm
 */
export function formatarDataHora(dataIso?: string | null): string {
  if (!dataIso) return '-';
  try {
    const d = new Date(dataIso);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return dataIso;
  }
}

/**
 * Arredonda para 2 casas decimais sem erro de ponto flutuante
 */
export function arredondarMoeda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula a Dívida Total do processo de distrato:
 * Débito de aluguel + soma de todas as verificações com pendência financeira
 */
export function calcularDividaTotal(distrato: Distrato): number {
  let total = distrato.debitoAluguel || 0;

  if (Array.isArray(distrato.verificacoes)) {
    for (const v of distrato.verificacoes) {
      if (v.tipo === 'camera_rastreador') {
        const cam = v.cameraValor || 0;
        const rast = v.rastreadorValor || 0;
        total += cam + rast;
      } else {
        total += v.valor || 0;
      }
    }
  }

  return arredondarMoeda(total);
}

/**
 * Soma dos pagamentos ativos (não cancelados)
 */
export function calcularTotalPago(distrato: Distrato): number {
  if (!Array.isArray(distrato.pagamentos)) return 0;
  const total = distrato.pagamentos
    .filter((p) => !p.cancelado)
    .reduce((acc, p) => acc + (p.valor || 0), 0);
  return arredondarMoeda(total);
}

/**
 * Saldo restante = Dívida Total - Pagamentos realizados
 * Trata precisão: se menor que R$ 0,01, considera 0 (quitado)
 */
export function calcularSaldoRestante(distrato: Distrato): number {
  const divida = calcularDividaTotal(distrato);
  const pago = calcularTotalPago(distrato);
  const diff = divida - pago;

  if (diff <= 0.0099) {
    return 0;
  }
  return arredondarMoeda(diff);
}

/**
 * Verifica se todas as 11 auditorias obrigatórias estão concluídas
 */
export function todasVerificacoesConcluidas(distrato: Distrato): {
  concluido: boolean;
  pendentesQtd: number;
  nomesPendentes: string[];
} {
  if (!Array.isArray(distrato.verificacoes) || distrato.verificacoes.length === 0) {
    return { concluido: false, pendentesQtd: 0, nomesPendentes: [] };
  }

  const naoConcluidas = distrato.verificacoes.filter(
    (v) => v.status === 'Aguardando análise' || v.status === 'Em análise'
  );

  return {
    concluido: naoConcluidas.length === 0,
    pendentesQtd: naoConcluidas.length,
    nomesPendentes: naoConcluidas.map((v) => v.titulo),
  };
}

/**
 * Recalcula e atualiza os status automáticos do distrato
 */
export function atualizarStatusAutomaticos(distrato: Distrato): {
  statusGeral: StatusDistrato;
  statusFinanceiro: StatusFinanceiro;
} {
  const divida = calcularDividaTotal(distrato);
  const pago = calcularTotalPago(distrato);
  const saldo = calcularSaldoRestante(distrato);
  const { concluido: todasAuditoriasOk } = todasVerificacoesConcluidas(distrato);

  let statusFinanceiro: StatusFinanceiro = 'Aguardando boleto';
  let statusGeral: StatusDistrato = distrato.statusGeral;

  // Se ajuizado
  if (distrato.encaminhadoAjuizamento) {
    statusFinanceiro = 'Em processo judicial';
    statusGeral = 'Ajuizado';
    return { statusGeral, statusFinanceiro };
  }

  // Se em protesto
  if (distrato.encaminhadoProtesto) {
    statusFinanceiro = 'Encaminhado para protesto';
    statusGeral = 'Em Protesto';
    return { statusGeral, statusFinanceiro };
  }

  // Regra de Quitação
  if (saldo === 0 && (pago > 0 || divida === 0)) {
    statusFinanceiro = 'Quitado';
    statusGeral = 'Quitado';
    return { statusGeral, statusFinanceiro };
  }

  // Se tem pagamento parcial
  if (pago > 0 && saldo > 0) {
    statusFinanceiro = 'Parcialmente pago';
    statusGeral = 'Em Cobrança';
    return { statusGeral, statusFinanceiro };
  }

  // Se tem boleto emitido
  if (distrato.dataEmissaoBoleto || distrato.dataVencimentoBoleto) {
    const hoje = new Date().toISOString().split('T')[0];
    const vencimento = distrato.dataVencimentoBoleto ? distrato.dataVencimentoBoleto.split('T')[0] : '';

    if (vencimento && vencimento < hoje) {
      statusFinanceiro = 'Vencido';
    } else {
      statusFinanceiro = 'A vencer';
    }
    statusGeral = 'Em Cobrança';
  } else {
    // Sem boleto ainda
    if (!todasAuditoriasOk) {
      statusGeral = 'Em Auditoria';
      statusFinanceiro = 'Aguardando boleto';
    } else {
      if (distrato.dataEmissaoDistrato) {
        statusGeral = 'Distrato Emitido';
      } else {
        statusGeral = 'Aguardando Emissão';
      }
      statusFinanceiro = 'Aguardando boleto';
    }
  }

  return { statusGeral, statusFinanceiro };
}
