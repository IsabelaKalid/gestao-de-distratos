import React from 'react';
import { Banknote, Scale, Files, ClipboardCheck, BarChart3, Eye, Printer } from 'lucide-react';
import { useDistratos } from '../context/DistratoContext';
import { calcularSaldoRestante, formatarMoeda, formatarData } from '../utils/calculations';
import type { AbaSistema, Distrato } from '../types';

type Modulo = Extract<AbaSistema, 'financeiro' | 'juridico' | 'documentos' | 'auditoria' | 'relatorios'>;
const CONFIG = {
  financeiro: { titulo: 'Cobrança e Pagamentos', descricao: 'Boletos, recebimentos e saldos em aberto.', Icon: Banknote },
  juridico: { titulo: 'Cobrança Jurídica', descricao: 'Processos aptos, protestados ou ajuizados.', Icon: Scale },
  documentos: { titulo: 'Central de Documentos', descricao: 'Arquivos anexados aos processos de distrato.', Icon: Files },
  auditoria: { titulo: 'Auditorias de Frota', descricao: 'Acompanhamento das verificações operacionais.', Icon: ClipboardCheck },
  relatorios: { titulo: 'Relatórios', descricao: 'Consulta e impressão dos termos e relatórios individuais.', Icon: BarChart3 },
} as const;

export const ModuloOperacionalView: React.FC<{ modulo: Modulo; onVerDetalhe: (id: string) => void; onImprimir: (d: Distrato) => void }> = ({ modulo, onVerDetalhe, onImprimir }) => {
  const { distratos } = useDistratos(); const { titulo, descricao, Icon } = CONFIG[modulo];
  const processos = distratos.filter((d) => modulo === 'documentos' ? d.documentos.length > 0 : modulo === 'juridico' ? calcularSaldoRestante(d) > 0 || d.encaminhadoProtesto || d.encaminhadoAjuizamento : true);
  return <section className="space-y-5 pb-12">
    <header className="rounded-2xl bg-gradient-to-r from-[#30080c] to-[#650f1d] p-6 text-white shadow-lg"><div className="flex items-center gap-3"><span className="rounded-xl border border-[#d3a84e]/45 bg-black/20 p-3"><Icon className="w-6 h-6 text-[#e7c784]"/></span><div><h1 className="text-2xl font-black">{titulo}</h1><p className="mt-1 text-sm text-stone-300">{descricao}</p></div></div></header>
    <div className="grid sm:grid-cols-3 gap-3"><div className="rounded-xl border bg-white p-4"><p className="text-xs text-stone-500">Processos exibidos</p><p className="mt-1 text-2xl font-black">{processos.length}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-stone-500">Saldo relacionado</p><p className="mt-1 text-lg font-black text-[#8e192a]">{formatarMoeda(processos.reduce((s,d)=>s+calcularSaldoRestante(d),0))}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-stone-500">Documentos vinculados</p><p className="mt-1 text-2xl font-black">{processos.reduce((s,d)=>s+d.documentos.length,0)}</p></div></div>
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden"><div className="divide-y divide-stone-100">{processos.map((d) => { const pendentes=d.verificacoes.filter(v=>v.status==='Aguardando análise'||v.status==='Em análise').length; return <article key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-[#fbf6ee] transition"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-sm text-[#7e1d2c]">{d.id}</strong><span className="text-xs rounded-full bg-stone-100 px-2 py-1">{d.statusGeral}</span></div><p className="mt-1 font-bold">{d.agregadoNome}</p><p className="mt-1 text-xs text-stone-500">{formatarData(d.dataSolicitacao)} • Saldo {formatarMoeda(calcularSaldoRestante(d))} • {d.documentos.length} documento(s) • {pendentes} auditoria(s) pendente(s)</p></div><div className="flex gap-2"><button type="button" onClick={()=>onVerDetalhe(d.id)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold hover:bg-white"><Eye className="w-4 h-4"/> Abrir</button>{modulo==='relatorios'&&<button type="button" onClick={()=>onImprimir(d)} className="inline-flex items-center gap-1 rounded-lg bg-[#7e1d2c] px-3 py-2 text-xs font-bold text-white"><Printer className="w-4 h-4"/> Relatório</button>}</div></article>; })}{!processos.length&&<p className="p-8 text-center text-sm text-stone-500">Nenhum processo encontrado neste módulo.</p>}</div></div>
  </section>;
};
