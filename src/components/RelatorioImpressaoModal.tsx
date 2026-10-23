import React from 'react';
import { X, Printer, Download, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';
import { Distrato } from '../types';
import {
  formatarMoeda,
  formatarData,
  calcularDividaTotal,
  calcularTotalPago,
  calcularSaldoRestante,
} from '../utils/calculations';
import { EMPRESA } from '../config/empresa';

interface RelatorioImpressaoModalProps {
  distrato: Distrato;
  isOpen: boolean;
  onClose: () => void;
}

export const RelatorioImpressaoModal: React.FC<RelatorioImpressaoModalProps> = ({
  distrato,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const dividaTotal = calcularDividaTotal(distrato);
  const totalPago = calcularTotalPago(distrato);
  const saldoRestante = calcularSaldoRestante(distrato);
  const conferenciasSuprimentos = distrato.verificacoes
    .filter((verificacao) => verificacao.tipo === 'suprimentos')
    .flatMap((verificacao) => verificacao.lancamentos || [])
    .filter((lancamento) => lancamento.auditoriaTipo);

  const handlePrint = () => {
    const tituloAnterior = document.title;
    document.title = `Relatorio-${distrato.id}`;
    const restaurarTitulo = () => {
      document.title = tituloAnterior;
      window.removeEventListener('afterprint', restaurarTitulo);
    };
    window.addEventListener('afterprint', restaurarTitulo);
    window.print();
  };

  return (
    <div className="report-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="report-modal-sheet relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto">
        {/* Barra Superior de Ações (Oculta na Impressão) */}
        <div className="no-print px-6 py-3.5 bg-[#26070a] border-b border-[#a87f3b]/30 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#dfc28d]" />
            <span className="text-sm font-bold text-stone-100">
              Termo Oficial de Distrato & Relatório de Conciliação
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#7e1d2c] hover:bg-[#681623] border border-[#c59b4c]/40 text-stone-100 text-xs font-bold transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#dfc28d]" />
              <span>Imprimir / Salvar em PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#340b10] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo do Relatório Formatado para Papel A4 */}
        <div className="report-document p-8 sm:p-12 text-slate-900 bg-white space-y-6">
          {/* Cabeçalho da Empresa */}
          <div className="flex items-start justify-between border-b-2 border-stone-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#29080d] border border-[#c59b4c]/60 flex items-center justify-center font-black text-xs text-[#dfc28d]">
                  {EMPRESA.nome.slice(0, 2).toUpperCase()}
                </div>
                <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
                  {EMPRESA.razaoSocial.toUpperCase()}
                </h1>
              </div>
              <p className="text-xs text-stone-600 font-medium mt-1">
                Departamento de Frotas, Gestão de Agregados e Auditoria Contratual
              </p>
              {EMPRESA.dadosCadastrais && (
                <p className="text-[11px] text-stone-500">{EMPRESA.dadosCadastrais}</p>
              )}
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 rounded bg-stone-100 border border-stone-300 font-mono text-xs font-bold text-stone-800">
                PROCESSO Nº: {distrato.id}
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Emitido em: {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Título do Documento */}
          <div className="text-center py-2 bg-slate-50 border border-slate-200 rounded">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
              TERMO DE RESCISÃO E APURAÇÃO DE PENDÊNCIAS FINANCEIRAS
            </h2>
          </div>

          {/* Dados do Agregado e Veículo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border border-slate-200 p-4 rounded-lg bg-slate-50/50">
            <div>
              <p className="text-slate-500 font-medium">Agregado / Razão Social:</p>
              <p className="font-bold text-slate-900 text-sm">{distrato.agregadoNome}</p>
              <p className="text-slate-600">Código Interno: <span className="font-mono font-semibold">{distrato.agregadoCodigo}</span></p>
              <p className="text-slate-600">Data da Solicitação: {formatarData(distrato.dataSolicitacao)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Veículo(s) Objeto do Distrato:</p>
              <p className="text-slate-800">
                Tipo: <strong className="font-bold">{distrato.tipoDistrato}</strong>
              </p>
              <p className="text-slate-800">
                Placa Cavalo: <span className="font-mono font-bold">{distrato.placaCavalo || 'N/A'}</span>
                {distrato.placaCarreta && (
                  <span> • Carreta: <span className="font-mono font-bold">{distrato.placaCarreta}</span></span>
                )}
              </p>
              <p className="text-slate-600">Operação / Rota: {distrato.gridOperacao} ({distrato.segmento})</p>
            </div>
          </div>

          {/* Quadro de Auditorias e Verificações */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              1. Discriminativo das Verificações e Auditorias Realizadas
            </h3>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs border border-slate-300 divide-y divide-slate-200">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="py-2 px-3">Item Auditado</th>
                  <th className="py-2 px-2">Data Conferência</th>
                  <th className="py-2 px-2">Status da Análise</th>
                  <th className="py-2 px-3 text-right">Valor Apurado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {distrato.debitoAluguel > 0 && (
                  <tr className="bg-slate-50">
                    <td className="py-2 px-3 font-medium">Débito de Aluguel de Carreta / Equipamento</td>
                    <td className="py-2 px-2">{formatarData(distrato.dataSolicitacao)}</td>
                    <td className="py-2 px-2 text-rose-700 font-semibold">Pendência Contratual</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      {formatarMoeda(distrato.debitoAluguel)}
                    </td>
                  </tr>
                )}
                {distrato.verificacoes.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-800">{v.titulo}</div>
                      {v.observacoes && (
                        <div className="text-[10px] text-slate-500 italic truncate max-w-sm">
                          {v.observacoes}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-slate-600">{formatarData(v.dataAuditoria)}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[11px] font-semibold ${
                        v.status === 'Pendência encontrada' ? 'text-rose-700 font-bold' : 'text-emerald-700'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">
                      {v.tipo === 'camera_rastreador'
                        ? formatarMoeda((v.cameraValor || 0) + (v.rastreadorValor || 0))
                        : formatarMoeda(v.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {conferenciasSuprimentos.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                2. Conferência da Auditoria de Suprimentos
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs border border-slate-300 divide-y divide-slate-200">
                  <thead className="bg-amber-50 font-bold text-slate-700">
                    <tr>
                      <th className="py-2 px-3">Registro auditado</th>
                      <th className="py-2 px-2">Tipo</th>
                      <th className="py-2 px-2 text-right">Valor lançado</th>
                      <th className="py-2 px-2 text-right">Valor auditado</th>
                      <th className="py-2 px-3 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {conferenciasSuprimentos.map((item) => {
                      const original = Number(item.valorOriginalAuditado || 0);
                      const auditado = Number(item.valorAuditado || item.valor || 0);
                      return (
                        <tr key={item.id}>
                          <td className="py-2 px-3">
                            <div className="font-semibold">{item.dividaAuditadaDescricao || item.observacoes || 'Pendência adicional'}</div>
                            {item.observacoes && item.dividaAuditadaDescricao && (
                              <div className="text-[10px] text-slate-500">{item.observacoes}</div>
                            )}
                          </td>
                          <td className="py-2 px-2">{item.auditoriaTipo}</td>
                          <td className="py-2 px-2 text-right font-mono">{formatarMoeda(original)}</td>
                          <td className="py-2 px-2 text-right font-mono">{formatarMoeda(auditado)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${Math.abs(auditado - original) > 0.009 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {formatarMoeda(auditado - original)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-2">
                {conferenciasSuprimentos.map((item, indice) => (
                  <div key={`achado-${item.id}`} className="border border-slate-200 rounded p-3 text-[10px] text-slate-700 break-inside-avoid">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <strong className="text-xs text-slate-900">Achado {indice + 1}: {item.auditoriaConclusao || item.auditoriaStatus || 'Em análise'}</strong>
                      <span className="font-semibold">Criticidade: {item.auditoriaSeveridade || 'Não classificada'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      <p><strong>Critério:</strong> {item.auditoriaCriterio || '-'}</p>
                      <p><strong>Situação encontrada:</strong> {item.auditoriaCondicao || '-'}</p>
                      <p><strong>Causa:</strong> {item.auditoriaCausa || '-'}</p>
                      <p><strong>Efeito/Risco:</strong> {item.auditoriaEfeito || '-'}</p>
                      <p className="sm:col-span-2"><strong>Recomendação:</strong> {item.auditoriaRecomendacao || '-'}</p>
                      <p><strong>Responsável:</strong> {item.auditoriaResponsavelAcao || '-'}</p>
                      <p><strong>Prazo:</strong> {formatarData(item.auditoriaPrazoAcao)}</p>
                      <p><strong>Evidências:</strong> {item.anexos?.length || 0} anexo(s)</p>
                      <p><strong>Auditor:</strong> {item.usuarioNome}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Os valores de conferência não alteram a dívida original. Apenas registros classificados como nova pendência entram no saldo.
              </p>
            </div>
          )}

          {/* Quadro de Fechamento Financeiro */}
          <div className="report-financial-summary border border-slate-300 rounded-lg p-4 bg-slate-50 space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
              {conferenciasSuprimentos.length > 0 ? '3.' : '2.'} Balanço Financeiro Final do Encerramento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:divide-x divide-slate-200 pt-2">
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-semibold">Total da Dívida Levantada</p>
                <p className="text-base font-extrabold text-rose-700 font-mono mt-0.5">
                  {formatarMoeda(dividaTotal)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-semibold">Total Quitado / Pago</p>
                <p className="text-base font-extrabold text-emerald-700 font-mono mt-0.5">
                  {formatarMoeda(totalPago)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase font-semibold">Saldo Devedor Remanescente</p>
                <p className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                  {formatarMoeda(saldoRestante)}
                </p>
              </div>
            </div>
            {saldoRestante === 0 && (
              <div className="p-2 bg-emerald-100/70 border border-emerald-300 rounded text-center text-xs font-bold text-emerald-900">
                PROCESSO TOTALMENTE QUITADO — NADA MAIS SENDO DEVIDO ENTRE AS PARTES
              </div>
            )}
          </div>

          {/* Campo de Assinaturas */}
          <div className="report-signatures pt-12 grid grid-cols-1 sm:grid-cols-2 gap-12 text-center text-xs">
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-900">{EMPRESA.razaoSocial.toUpperCase()}</p>
              <p className="text-slate-500">Representante Legal / Gerência de Frotas</p>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-900">{distrato.agregadoNome}</p>
              <p className="text-slate-500">Agregado Transportador / Procurador</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
