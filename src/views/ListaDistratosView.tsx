import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  PlusCircle,
  Truck,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { useDistratos } from '../context/DistratoContext';
import { Distrato, StatusDistrato, StatusFinanceiro } from '../types';
import {
  formatarMoeda,
  formatarData,
  calcularDividaTotal,
  calcularSaldoRestante,
  calcularTotalPago,
} from '../utils/calculations';
import { StatusBadge } from '../components/StatusBadge';

interface ListaDistratosViewProps {
  onVerDetalhe: (id: string) => void;
  onOpenNovoDistrato: () => void;
  onOpenImprimir: (distrato: Distrato) => void;
}

export const ListaDistratosView: React.FC<ListaDistratosViewProps> = ({
  onVerDetalhe,
  onOpenNovoDistrato,
  onOpenImprimir,
}) => {
  const { distratos } = useDistratos();

  // Estados de busca e filtros
  const [busca, setBusca] = useState('');
  const [filtroStatusGeral, setFiltroStatusGeral] = useState<string>('todos');
  const [filtroStatusFinanceiro, setFiltroStatusFinanceiro] = useState<string>('todos');
  const [filtroSegmento, setFiltroSegmento] = useState<string>('todos');
  const [ordenarPor, setOrdenarPor] = useState<'id' | 'data' | 'nome' | 'divida'>('data');
  const [ordemDesc, setOrdemDesc] = useState(true);

  const segmentosDisponiveis = useMemo(
    () => Array.from(new Set(distratos.map((d) => d.segmento?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [distratos]
  );

  // Paginação simples
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 8;

  // Filtragem
  const distratosFiltrados = useMemo(() => {
    return distratos
      .filter((d) => {
        // Busca textual
        const termo = busca.toLowerCase();
        const matchTexto =
          d.id.toLowerCase().includes(termo) ||
          d.agregadoNome.toLowerCase().includes(termo) ||
          d.agregadoCodigo.toLowerCase().includes(termo) ||
          d.placaCavalo.toLowerCase().includes(termo) ||
          (d.placaCarreta && d.placaCarreta.toLowerCase().includes(termo));

        if (!matchTexto) return false;

        // Filtro de status geral
        if (filtroStatusGeral !== 'todos' && d.statusGeral !== filtroStatusGeral) {
          return false;
        }

        // Filtro de status financeiro
        if (
          filtroStatusFinanceiro !== 'todos' &&
          d.statusFinanceiro !== filtroStatusFinanceiro
        ) {
          return false;
        }

        // Filtro de segmento
        if (filtroSegmento !== 'todos' && d.segmento !== filtroSegmento) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let fator = ordemDesc ? -1 : 1;
        if (ordenarPor === 'id') {
          return a.id.localeCompare(b.id) * fator;
        }
        if (ordenarPor === 'nome') {
          return a.agregadoNome.localeCompare(b.agregadoNome) * fator;
        }
        if (ordenarPor === 'divida') {
          const divA = calcularDividaTotal(a);
          const divB = calcularDividaTotal(b);
          return (divA - divB) * fator;
        }
        // data
        return (
          (new Date(a.dataSolicitacao).getTime() - new Date(b.dataSolicitacao).getTime()) * fator
        );
      });
  }, [
    distratos,
    busca,
    filtroStatusGeral,
    filtroStatusFinanceiro,
    filtroSegmento,
    ordenarPor,
    ordemDesc,
  ]);

  // Paginação
  const totalPaginas = Math.ceil(distratosFiltrados.length / ITENS_POR_PAGINA) || 1;
  const distratosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return distratosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [distratosFiltrados, paginaAtual]);

  // Exportar CSV
  const handleExportarCSV = () => {
    const headers = [
      'ID',
      'Agregado',
      'Codigo',
      'Placa Cavalo',
      'Placa Carreta',
      'Tipo Distrato',
      'Segmento',
      'Data Solicitacao',
      'Status Geral',
      'Status Financeiro',
      'Divida Total',
      'Total Pago',
      'Saldo Restante',
    ];

    const rows = distratosFiltrados.map((d) => [
      d.id,
      `"${d.agregadoNome.replace(/"/g, '""')}"`,
      d.agregadoCodigo,
      d.placaCavalo,
      d.placaCarreta || '',
      d.tipoDistrato,
      d.segmento,
      d.dataSolicitacao,
      d.statusGeral,
      d.statusFinanceiro,
      calcularDividaTotal(d).toFixed(2),
      calcularTotalPago(d).toFixed(2),
      calcularSaldoRestante(d).toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_distratos_transpanorama_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#865d1d]">
            <span>Módulo de Frotas & Operações</span>
            <span>•</span>
            <span>Transpanorama Transportes</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mt-0.5">
            Gerenciamento de Distratos
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Cada processo de rescisão com agregados possui ID único, auditoria das 11 áreas e conciliação financeira.
          </p>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 w-full sm:w-auto">
          <button
            id="btn-exportar-csv"
            type="button"
            onClick={handleExportarCSV}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl shadow-2xs transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-stone-500" />
            <span>Exportar Planilha</span>
          </button>

          <button
            id="btn-novo-distrato-lista"
            type="button"
            onClick={onOpenNovoDistrato}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-stone-100 bg-[#7e1d2c] hover:bg-[#681623] active:bg-[#54101a] border border-[#c59b4c]/40 rounded-xl shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#dfc28d]" />
            <span>Novo Distrato</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="card-gradient-hover bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              id="input-busca-distratos"
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPaginaAtual(1);
              }}
              placeholder="Buscar por ID (ex: DIS-2026-001), nome do agregado, código ou placa..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-stone-50/50 border border-stone-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none transition"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-stone-500 hidden sm:inline">Ordenar:</span>
            <select
              id="select-ordenar"
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as any)}
              className="px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none cursor-pointer"
            >
              <option value="data">Data de Solicitação</option>
              <option value="id">Número do Processo</option>
              <option value="nome">Nome do Agregado</option>
              <option value="divida">Valor da Dívida</option>
            </select>
            <button
              id="btn-toggle-ordem"
              type="button"
              onClick={() => setOrdemDesc((prev) => !prev)}
              title={ordemDesc ? 'Ordem Decrescente' : 'Ordem Crescente'}
              className="p-2 border border-stone-300 rounded-xl hover:bg-stone-50 text-stone-600 cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filtros em Linha */}
        <div className="pt-2 border-t border-stone-100 grid grid-cols-1 min-[480px]:grid-cols-2 md:flex md:flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-stone-400 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold text-[11px] uppercase tracking-wider">Filtros:</span>
          </div>

          {/* Filtro Status Geral */}
          <select
            id="filtro-status-geral"
            value={filtroStatusGeral}
            onChange={(e) => {
              setFiltroStatusGeral(e.target.value);
              setPaginaAtual(1);
            }}
            className="w-full md:w-auto px-2.5 py-2 md:py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 hover:bg-white focus:ring-1 focus:ring-[#7e1d2c] outline-none cursor-pointer"
          >
            <option value="todos">Status Geral (Todos)</option>
            <option value="Em Aberto">Em Aberto</option>
            <option value="Em Auditoria">Em Auditoria</option>
            <option value="Aguardando Emissão">Aguardando Emissão</option>
            <option value="Em Cobrança">Em Cobrança</option>
            <option value="Em Protesto">Em Protesto</option>
            <option value="Ajuizado">Ajuizado</option>
            <option value="Quitado">Quitado</option>
          </select>

          {/* Filtro Status Financeiro */}
          <select
            id="filtro-status-financeiro"
            value={filtroStatusFinanceiro}
            onChange={(e) => {
              setFiltroStatusFinanceiro(e.target.value);
              setPaginaAtual(1);
            }}
            className="w-full md:w-auto px-2.5 py-2 md:py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 hover:bg-white focus:ring-1 focus:ring-[#7e1d2c] outline-none cursor-pointer"
          >
            <option value="todos">Financeiro (Todos)</option>
            <option value="Sem pendências">Sem pendências</option>
            <option value="Aguardando boleto">Aguardando boleto</option>
            <option value="A vencer">A vencer</option>
            <option value="Vencido">Vencido</option>
            <option value="Parcialmente pago">Parcialmente pago</option>
            <option value="Quitado">Quitado</option>
          </select>

          {/* Filtro Segmento */}
          <select
            id="filtro-segmento"
            value={filtroSegmento}
            onChange={(e) => {
              setFiltroSegmento(e.target.value);
              setPaginaAtual(1);
            }}
            className="w-full md:w-auto px-2.5 py-2 md:py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 hover:bg-white focus:ring-1 focus:ring-[#7e1d2c] outline-none cursor-pointer"
          >
            <option value="todos">Segmento (Todos)</option>
            {segmentosDisponiveis.map((segmento) => (
              <option key={segmento} value={segmento}>{segmento}</option>
            ))}
          </select>

          {(busca ||
            filtroStatusGeral !== 'todos' ||
            filtroStatusFinanceiro !== 'todos' ||
            filtroSegmento !== 'todos') && (
            <button
              id="btn-limpar-filtros"
              type="button"
              onClick={() => {
                setBusca('');
                setFiltroStatusGeral('todos');
                setFiltroStatusFinanceiro('todos');
                setFiltroSegmento('todos');
                setPaginaAtual(1);
              }}
              className="text-[11px] font-semibold text-[#8e192a] hover:underline ml-auto"
            >
              Resetar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Cartões para celular: evitam rolagem horizontal da tabela */}
      <div className="md:hidden space-y-3">
        {distratosPaginados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-500">
            <Truck className="w-8 h-8 mx-auto mb-2 text-stone-300" />
            <p className="font-semibold text-sm">Nenhum distrato encontrado</p>
          </div>
        ) : distratosPaginados.map((proc) => {
          const divida = calcularDividaTotal(proc);
          const saldo = calcularSaldoRestante(proc);
          return (
            <article
              key={proc.id}
              onClick={() => onVerDetalhe(proc.id)}
              className="card-gradient-hover bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs active:bg-stone-50 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-block font-mono text-[11px] font-bold bg-stone-100 border rounded px-2 py-0.5">{proc.id}</span>
                  <h2 className="font-bold text-sm text-stone-900 mt-2 break-words">{proc.agregadoNome}</h2>
                  <p className="text-[11px] text-stone-500 mt-0.5">{proc.agregadoCodigo} • {formatarData(proc.dataSolicitacao)}</p>
                </div>
                <Eye className="w-5 h-5 text-[#7e1d2c] shrink-0" />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <StatusBadge status={proc.statusGeral} size="sm" />
                <StatusBadge status={proc.statusFinanceiro} size="sm" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-stone-100 text-xs">
                <div><span className="block text-[10px] text-stone-400">Veículo(s)</span><strong className="font-mono">{proc.placaCavalo || proc.placaCarreta || '-'}</strong></div>
                <div><span className="block text-[10px] text-stone-400">Segmento</span><strong>{proc.segmento}</strong></div>
                <div><span className="block text-[10px] text-stone-400">Dívida total</span><strong>{formatarMoeda(divida)}</strong></div>
                <div><span className="block text-[10px] text-stone-400">Saldo aberto</span><strong className="text-[#8e192a]">{formatarMoeda(saldo)}</strong></div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenImprimir(proc); }}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 border border-stone-300 rounded-xl py-2 text-xs font-semibold text-stone-700"
              >
                <Printer className="w-4 h-4" /> Imprimir relatório
              </button>
            </article>
          );
        })}
      </div>

      {/* Tabela Corporativa de Distratos */}
      <div className="hidden md:block distrato-table-shell rounded-2xl border border-[#dbc9aa] shadow-sm overflow-hidden">
        <div className="overflow-x-auto px-3 pb-3">
          <table className="distrato-table w-full text-left text-xs">
            <thead className="text-stone-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Processo ID</th>
                <th className="py-3.5 px-4">Agregado / Código</th>
                <th className="py-3.5 px-4">Veículo(s) & Segmento</th>
                <th className="py-3.5 px-3">Data</th>
                <th className="py-3.5 px-3">Status do Processo</th>
                <th className="py-3.5 px-3">Status Financeiro</th>
                <th className="py-3.5 px-4 text-right">Dívida Total</th>
                <th className="py-3.5 px-4 text-right">Saldo Aberto</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {distratosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-600 text-sm">Nenhum distrato encontrado</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Tente alterar os termos de busca ou filtros selecionados.
                    </p>
                  </td>
                </tr>
              ) : (
                distratosPaginados.map((proc) => {
                  const divida = calcularDividaTotal(proc);
                  const saldo = calcularSaldoRestante(proc);
                  const isQuitado = proc.statusGeral === 'Quitado';
                  const isVencido = proc.statusFinanceiro === 'Vencido';

                  return (
                    <tr
                      key={proc.id}
                      id={`linha-distrato-${proc.id}`}
                      onClick={() => onVerDetalhe(proc.id)}
                      className="distrato-table-row transition cursor-pointer group"
                    >
                      {/* ID */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-stone-900 bg-stone-100 group-hover:bg-[#f5ebd7] px-2 py-0.5 rounded border border-stone-200/60 transition">
                          {proc.id}
                        </span>
                      </td>

                      {/* Agregado */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-800 text-xs">
                          {proc.agregadoNome}
                        </div>
                        <div className="font-mono text-[10px] text-stone-500">
                          {proc.agregadoCodigo}
                        </div>
                      </td>

                      {/* Veículo e Segmento */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-stone-800">
                          <span>{proc.placaCavalo}</span>
                          {proc.placaCarreta && (
                            <span className="text-stone-400 font-normal">/ {proc.placaCarreta}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {proc.tipoDistrato} • {proc.segmento}
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-3 px-3 text-stone-600 text-[11px] whitespace-nowrap">
                        {formatarData(proc.dataSolicitacao)}
                      </td>

                      {/* Status Geral */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={proc.statusGeral} size="sm" />
                      </td>

                      {/* Status Financeiro */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={proc.statusFinanceiro} size="sm" />
                      </td>

                      {/* Dívida Total */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-stone-800 whitespace-nowrap">
                        {formatarMoeda(divida)}
                      </td>

                      {/* Saldo Aberto */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isQuitado
                              ? 'text-emerald-700'
                              : isVencido
                              ? 'text-[#8e192a]'
                              : saldo > 0
                              ? 'text-stone-900'
                              : 'text-stone-500'
                          }`}
                        >
                          {formatarMoeda(saldo)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td
                        className="py-3 px-4 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Ver detalhes do processo"
                            onClick={() => onVerDetalhe(proc.id)}
                            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Gerar / Imprimir Relatório"
                            onClick={() => onOpenImprimir(proc)}
                            className="p-1.5 rounded-lg text-stone-600 hover:text-[#7e1d2c] hover:bg-[#fbf3f4] transition cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela & Paginação */}
        <div className="px-4 py-3 bg-[#fcfbf9] border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div>
            Mostrando{' '}
            <strong className="font-bold text-stone-800">
              {distratosFiltrados.length === 0
                ? 0
                : (paginaAtual - 1) * ITENS_POR_PAGINA + 1}
            </strong>{' '}
            a{' '}
            <strong className="font-bold text-stone-800">
              {Math.min(paginaAtual * ITENS_POR_PAGINA, distratosFiltrados.length)}
            </strong>{' '}
            de <strong className="font-bold text-stone-800">{distratosFiltrados.length}</strong>{' '}
            processos cadastrados
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="btn-pag-anterior"
              type="button"
              disabled={paginaAtual <= 1}
              onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="px-3 py-1 text-stone-600 font-medium">
              Página {paginaAtual} de {totalPaginas}
            </span>

            <button
              id="btn-pag-proximo"
              type="button"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
