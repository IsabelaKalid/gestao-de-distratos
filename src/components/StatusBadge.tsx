import React from 'react';
import { StatusDistrato, StatusFinanceiro, StatusVerificacao } from '../types';

interface StatusBadgeProps {
  status: StatusDistrato | StatusFinanceiro | StatusVerificacao | string;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', id }) => {
  let bg = 'bg-stone-100 text-stone-700 border-stone-200';
  let dot = 'bg-stone-400';

  // Verde suave: Concluídos, quitados, sem pendências
  if (
    status === 'Quitado' ||
    status === 'Finalizado' ||
    status === 'Sem pendências' ||
    status === 'Concluída' ||
    status === 'Desvinculado' ||
    status === 'Conforme'
  ) {
    bg = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    dot = 'bg-emerald-600';
  }
  // Âmbar / Ouro quente suave: Em análise, a vencer, aguardando
  else if (
    status === 'Aguardando análise' ||
    status === 'Em análise' ||
    status === 'Aguardando boleto' ||
    status === 'Aguardando Emissão' ||
    status === 'A vencer' ||
    status === 'Boleto emitido' ||
    status === 'Parcialmente pago' ||
    status === 'Em negociação' ||
    status === 'Pendente' ||
    status === 'Protocolado'
  ) {
    bg = 'bg-amber-50/90 text-amber-900 border-amber-200/80';
    dot = 'bg-amber-500';
  }
  // Vinho / Carmim sóbrio (não neon): Atrasos, pendência encontrada, vencido, protesto, ajuizado
  else if (
    status === 'Vencido' ||
    status === 'Pendência encontrada' ||
    status === 'Em Protesto' ||
    status === 'Encaminhado para protesto' ||
    status === 'Ajuizado' ||
    status === 'Em processo judicial' ||
    status === 'Inconforme' ||
    status === 'Cancelado'
  ) {
    bg = 'bg-[#fcf1f2] text-[#8e192a] border-[#f3ccd2] font-semibold';
    dot = 'bg-[#a31f33]';
  }
  // Tom vinho sutil / ardósia suave: Processos em andamento, em aberto, emitidos
  else if (
    status === 'Em Aberto' ||
    status === 'Em andamento' ||
    status === 'Em Auditoria' ||
    status === 'Distrato Emitido' ||
    status === 'Em Cobrança'
  ) {
    bg = 'bg-stone-100/90 text-stone-800 border-stone-300';
    dot = 'bg-[#7e1d2c]';
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs font-medium px-2.5 py-0.5 gap-1.5',
    lg: 'text-xs font-semibold px-3 py-1 gap-2',
  }[size];

  return (
    <span
      id={id}
      className={`inline-flex items-center rounded-full border whitespace-nowrap transition-colors ${sizeClasses} ${bg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      <span>{status}</span>
    </span>
  );
};
