import React, { useMemo } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Gavel,
  Landmark,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Filter,
  Truck,
  UserCheck,
  ChevronRight,
  ShieldAlert,
  BookOpenCheck,
  ChevronDown,
} from 'lucide-react';
import { useDistratos } from '../context/DistratoContext';
import {
  formatarMoeda,
  calcularDividaTotal,
  calcularTotalPago,
  calcularSaldoRestante,
  formatarData,
} from '../utils/calculations';
import { StatusBadge } from '../components/StatusBadge';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EMPRESA } from '../config/empresa';

const CORES_STATUS: Record<string, string> = {
  Quitado: '#059669',
  'Em Auditoria': '#c59b4c',
  'Em Protesto': '#8e192a',
  Ajuizado: '#54101a',
  Cancelado: '#78716c',
};

const formatarMoedaCompacta = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 1,
  }).format(valor);

interface DashboardViewProps {
  onVerDistrato: (id: string) => void;
  onVerTodosDistratos: () => void;
  onOpenNovoDistrato: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onVerDistrato,
  onVerTodosDistratos,
  onOpenNovoDistrato,
}) => {
  const { distratos, usuarioAtual } = useDistratos();

  // Métricas Consolidadas
  const metricas = useMemo(() => {
    let totalDivida = 0;
    let totalPago = 0;
    let saldoPendente = 0;
    let totalVencido = 0;
    let concluidos = 0;
    let emAndamento = 0;
    let emProtesto = 0;
    let ajuizados = 0;

    distratos.forEach((d) => {
      const divida = calcularDividaTotal(d);
      const pago = calcularTotalPago(d);
      const saldo = calcularSaldoRestante(d);

      totalDivida += divida;
      totalPago += pago;
      saldoPendente += saldo;

      if (d.statusGeral === 'Quitado') {
        concluidos++;
      } else if (d.statusGeral !== 'Cancelado') {
        emAndamento++;
      }

      if (d.statusGeral === 'Em Protesto' || d.encaminhadoProtesto) {
        emProtesto++;
      }
      if (d.statusGeral === 'Ajuizado' || d.encaminhadoAjuizamento) {
        ajuizados++;
      }
      if (d.statusFinanceiro === 'Vencido') {
        totalVencido += saldo;
      }
    });

    return {
      total: distratos.length,
      emAndamento,
      concluidos,
      totalDivida,
      totalPago,
      saldoPendente,
      totalVencido,
      emProtesto,
      ajuizados,
    };
  }, [distratos]);

  // Agrupamentos para gráficos
  const porStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    distratos.forEach((d) => {
      counts[d.statusGeral] = (counts[d.statusGeral] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [distratos]);

  const porSegmento = useMemo(() => {
    const counts: Record<string, { count: number; divida: number }> = {};
    distratos.forEach((d) => {
      const seg = d.segmento || 'Outros';
      if (!counts[seg]) counts[seg] = { count: 0, divida: 0 };
      counts[seg].count += 1;
      counts[seg].divida += calcularDividaTotal(d);
    });
    return Object.entries(counts).map(([segmento, data]) => ({
      segmento,
      count: data.count,
      divida: data.divida,
    }));
  }, [distratos]);

  const porResponsavel = useMemo(() => {
    const counts: Record<string, number> = {};
    distratos.forEach((d) => {
      const resp = d.responsavelAtualNome || 'Não atribuído';
      counts[resp] = (counts[resp] || 0) + 1;
    });
    return Object.entries(counts).map(([responsavel, count]) => ({ responsavel, count }));
  }, [distratos]);

  const evolucaoMensal = useMemo(() => {
    const meses: Record<string, { ordem: number; mes: string; quantidade: number; divida: number }> = {};

    distratos.forEach((d) => {
      const data = new Date(`${d.dataSolicitacao}T12:00:00`);
      if (Number.isNaN(data.getTime())) return;
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      if (!meses[chave]) {
        meses[chave] = {
          ordem: data.getFullYear() * 12 + data.getMonth(),
          mes: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
            .format(data)
            .replace('.', ''),
          quantidade: 0,
          divida: 0,
        };
      }
      meses[chave].quantidade += 1;
      meses[chave].divida += calcularDividaTotal(d);
    });

    return Object.values(meses).sort((a, b) => a.ordem - b.ordem).slice(-12);
  }, [distratos]);

  // Lista de processos em atenção crítica (Vencidos, Protesto ou Ajuizados)
  const processosCriticos = useMemo(() => {
    return distratos
      .filter(
        (d) =>
          d.statusFinanceiro === 'Vencido' ||
          d.statusGeral === 'Em Protesto' ||
          d.statusGeral === 'Ajuizado'
      )
      .slice(0, 4);
  }, [distratos]);

  // Últimos 5 distratos
  const distratosRecentes = useMemo(() => {
    return [...distratos]
      .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
      .slice(0, 5);
  }, [distratos]);

  return (
    <div className="space-y-6 pb-12">
      {/* Banner de Boas-Vindas Executivo */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#220609] via-[#2f080e] to-[#1c0406] p-6 sm:p-8 text-white shadow-lg border border-[#a87f3b]/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#3d0f16] text-[#dfc28d] text-xs font-semibold mb-2 border border-[#c59b4c]/30">
              <Truck className="w-3.5 h-3.5 text-[#dfc28d]" />
              <span>{EMPRESA.nome} • Painel de Conciliação e Distratos</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-100">
              Visão Executiva de Encerramentos Contratuais
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-2xl leading-relaxed">
              Acompanhamento centralizado de auditorias de pátio, desvinculação ANTT, levantamento de pendências financeiras e recuperação jurídica.
            </p>
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={onVerTodosDistratos}
              className="px-4 py-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-100 text-xs font-semibold border border-stone-600 transition cursor-pointer text-center"
            >
              Consultar Base Completa
            </button>
            <button
              type="button"
              onClick={onOpenNovoDistrato}
              className="px-4 py-2.5 rounded-xl bg-[#7e1d2c] hover:bg-[#681623] active:bg-[#56111b] border border-[#c59b4c]/40 text-stone-100 text-xs font-bold shadow-sm transition cursor-pointer text-center"
            >
              + Novo Distrato
            </button>
          </div>
        </div>
      </div>

      <details className="group rounded-2xl border border-[#e4d3b5] bg-[#fffaf0] shadow-2xs">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-[#e4d3b5] bg-white p-2 text-[#7e1d2c]"><BookOpenCheck className="h-4 w-4" /></span>
            <div>
              <h2 className="text-sm font-bold text-stone-900">Conduta e boas práticas do distrato</h2>
              <p className="text-[11px] text-stone-500">Checklist operacional, financeiro, documental e de proteção de dados.</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-1 gap-3 border-t border-[#eadcc4] px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['1. Abrir com dados conferidos', 'Confirme agregado, empresa, placas, grid, segmento, datas de engate e vínculo contratual antes de iniciar as consultas.'],
            ['2. Anexar a origem do processo', 'Guarde a solicitação de encerramento, contrato/termo e documentos relevantes já no cadastro, sempre na categoria correta.'],
            ['3. Registrar fatos com evidência', 'Toda pendência deve ter categoria, descrição, data, valor, responsável e comprovante. Não altere valores para “fazer bater”.'],
            ['4. Preservar a trilha', 'Corrija por edição registrada ou cancele com justificativa. Não exclua lançamentos ou evidências apenas para ocultar um erro.'],
            ['5. Separar análise e pagamento', 'O setor informa o valor; a Auditoria confere; o Financeiro vincula o pagamento à dívida. Quitação exige comprovante.'],
            ['6. Encerrar somente após conferir', 'Valide saldo, auditorias, ANTT/CIOT, documentos e termo. Finalize apenas quando as pendências estiverem resolvidas ou formalmente justificadas.'],
          ].map(([titulo, texto]) => (
            <div key={titulo} className="rounded-xl border border-[#eee3d0] bg-white p-3">
              <h3 className="text-xs font-bold text-stone-800">{titulo}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-600">{texto}</p>
            </div>
          ))}
          <p className="md:col-span-2 xl:col-span-3 text-[10px] leading-relaxed text-stone-500">
            Regra de acesso: use conta individual, consulte apenas processos necessários ao trabalho e não compartilhe documentos fora do fluxo autorizado. Casos jurídicos ou contratuais excepcionais devem ser validados pelo Jurídico.
          </p>
        </div>
      </details>

      {/* Grid de 8 Cards de KPIs Principais */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total de Distratos */}
        <div className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Total de Distratos</span>
            <div className="p-2 rounded-lg bg-[#fbf6ee] text-[#865d1d] border border-[#f0e3ce]">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-stone-900">{metricas.total}</span>
            <span className="text-[11px] font-medium text-stone-500">processos</span>
          </div>
          <div className="mt-2 text-[11px] text-stone-400">
            Base histórica consolidada
          </div>
        </div>

        {/* Card 2: Em Andamento */}
        <div className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Em Andamento</span>
            <div className="p-2 rounded-lg bg-[#fbf3f4] text-[#7e1d2c] border border-[#f5ccd3]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#7e1d2c]">{metricas.emAndamento}</span>
            <span className="text-[11px] font-semibold text-stone-500">auditorias/cobrança</span>
          </div>
          <div className="mt-2 text-[11px] text-stone-400">
            Aguardando quitação ou termo
          </div>
        </div>

        {/* Card 3: Concluídos e Quitados */}
        <div className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Processos Concluídos</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700">{metricas.concluidos}</span>
            <span className="text-[11px] font-semibold text-emerald-800">100% quitados</span>
          </div>
          <div className="mt-2 text-[11px] text-stone-400">
            Saldo zerado e termo finalizado
          </div>
        </div>

        {/* Card 4: Valores Vencidos (Destaque sóbrio em tom carmim/vinho) */}
        <div className="card-gradient-hover bg-[#fdf5f6] p-4 rounded-xl border border-[#f3ccd2] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8e192a]">Valores Vencidos</span>
            <div className="p-2 rounded-lg bg-[#8e192a] text-white shadow-2xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-[#8e192a] font-mono">
              {formatarMoeda(metricas.totalVencido)}
            </span>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-[#8e192a]">
            Boletos com prazo de pagamento expirado
          </div>
        </div>

        {/* Card 5: Dívida Total Identificada */}
        <div className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Dívida Total Levantada</span>
            <div className="p-2 rounded-lg bg-stone-100 text-stone-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-stone-900 font-mono">
              {formatarMoeda(metricas.totalDivida)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-stone-400">
            Aluguel + avarias + multas + taxas
          </div>
        </div>

        {/* Card 6: Total Recebido */}
        <div className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Total Recebido</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-emerald-700 font-mono">
              {formatarMoeda(metricas.totalPago)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-700 font-medium">
            Pagamentos parciais e integrais
          </div>
        </div>

        {/* Card 7: Saldo Pendente Geral */}
        <div className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Saldo a Recuperar</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-amber-900 font-mono">
              {formatarMoeda(metricas.saldoPendente)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-stone-400">
            Em cobrança ou negociação
          </div>
        </div>

        {/* Card 8: Jurídico (Protesto e Ajuizados) */}
        <div className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Recuperação Jurídica</span>
            <div className="p-2 rounded-lg bg-[#faf5ec] text-[#865d1d] border border-[#edd7b6]">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-lg font-black text-stone-800">{metricas.emProtesto}</span>
              <span className="text-[10px] text-stone-500 block">Em Protesto</span>
            </div>
            <div className="h-7 w-px bg-stone-200" />
            <div>
              <span className="text-lg font-black text-[#8e192a]">{metricas.ajuizados}</span>
              <span className="text-[10px] text-stone-500 block">Ajuizados</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-[#865d1d] font-medium">
            Títulos em execução extrajudicial
          </div>
        </div>
      </div>

      {/* Gráficos alimentados pelos dados atuais do Supabase */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-gradient-hover bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Evolução mensal dos distratos</h3>
            <p className="text-[11px] text-stone-500 mt-1">Quantidade de solicitações registradas nos últimos 12 meses com movimento.</p>
          </div>
          <div className="h-64 sm:h-72 min-w-0 overflow-hidden">
            {evolucaoMensal.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoMensal} margin={{ top: 8, right: 14, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(valor) => [`${valor} distrato(s)`, 'Quantidade']} labelStyle={{ fontWeight: 700 }} />
                  <Line type="monotone" dataKey="quantidade" name="Distratos" stroke="#7e1d2c" strokeWidth={3} dot={{ r: 4, fill: '#c59b4c', stroke: '#7e1d2c', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-full grid place-items-center text-sm text-stone-400">Cadastre distratos para visualizar a evolução.</div>}
          </div>
        </div>

        <div className="card-gradient-hover bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Distribuição por status</h3>
            <p className="text-[11px] text-stone-500 mt-1">Participação de cada etapa no total de {distratos.length} processos.</p>
          </div>
          <div className="h-64 sm:h-72 min-w-0 overflow-hidden">
            {porStatus.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porStatus} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {porStatus.map(({ status }, index) => <Cell key={status} fill={CORES_STATUS[status] ?? ['#7e1d2c', '#c59b4c', '#3d0f16', '#a87f3b'][index % 4]} />)}
                  </Pie>
                  <Tooltip formatter={(valor) => [`${valor} processo(s)`, 'Quantidade']} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full grid place-items-center text-sm text-stone-400">Nenhum status disponível.</div>}
          </div>
        </div>

        <div className="card-gradient-hover bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Dívida por segmento</h3>
            <p className="text-[11px] text-stone-500 mt-1">Valor total identificado em cada tipo de operação.</p>
          </div>
          <div className="h-64 sm:h-72 min-w-0 overflow-hidden">
            {porSegmento.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porSegmento} layout="vertical" margin={{ top: 4, right: 18, left: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
                  <XAxis type="number" tickFormatter={formatarMoedaCompacta} tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="segmento" width={90} tick={{ fontSize: 10, fill: '#57534e' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(valor) => [formatarMoeda(Number(valor)), 'Dívida']} />
                  <Bar dataKey="divida" name="Dívida" fill="#7e1d2c" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full grid place-items-center text-sm text-stone-400">Nenhum segmento disponível.</div>}
          </div>
        </div>

        <div className="card-gradient-hover bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Processos por responsável</h3>
            <p className="text-[11px] text-stone-500 mt-1">Carga atual distribuída entre as pessoas e áreas responsáveis.</p>
          </div>
          <div className="h-64 sm:h-72 min-w-0 overflow-hidden">
            {porResponsavel.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porResponsavel} margin={{ top: 4, right: 12, left: -22, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="responsavel" interval={0} angle={-18} textAnchor="end" height={62} tick={{ fontSize: 9, fill: '#57534e' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(valor) => [`${valor} processo(s)`, 'Quantidade']} />
                  <Bar dataKey="count" name="Processos" fill="#c59b4c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full grid place-items-center text-sm text-stone-400">Nenhum responsável disponível.</div>}
          </div>
        </div>
      </div>

      {/* Linha Dupla: Alertas Críticos & Distratos Mais Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas Críticos de Cobrança e Prazos */}
        <div className="card-gradient-hover bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 bg-[#fdf5f6] border-b border-[#f3ccd2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#8e192a]" />
              <h3 className="text-xs font-bold text-[#8e192a] uppercase tracking-wider">
                Atenção Crítica: Vencidos, Protestos & Ações
              </h3>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#fae2e5] text-[#8e192a] border border-[#f3ccd2]">
              {processosCriticos.length} casos
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {processosCriticos.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500">
                Nenhum processo com inadimplência ou restrição jurídica no momento.
              </div>
            ) : (
              processosCriticos.map((proc) => {
                const saldo = calcularSaldoRestante(proc);
                return (
                  <div
                    key={proc.id}
                    onClick={() => onVerDistrato(proc.id)}
                    className="p-4 hover:bg-stone-50/80 transition flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200/60">
                          {proc.id}
                        </span>
                        <StatusBadge status={proc.statusGeral} size="sm" />
                        <StatusBadge status={proc.statusFinanceiro} size="sm" />
                      </div>
                      <p className="text-xs font-bold text-stone-800 truncate">
                        {proc.agregadoNome}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        Placas: <span className="font-mono">{proc.placaCavalo} / {proc.placaCarreta || '-'}</span> • Resp: {proc.responsavelAtualNome}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-[#8e192a] block">
                        {formatarMoeda(saldo)}
                      </span>
                      <span className="text-[10px] text-stone-400 block">
                        Saldo Aberto
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Distratos Mais Recentes */}
        <div className="card-gradient-hover bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#7e1d2c]" />
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Distratos Recentes
              </h3>
            </div>
            <button
              type="button"
              onClick={onVerTodosDistratos}
              className="text-xs font-semibold text-[#7e1d2c] hover:text-[#54101a] transition cursor-pointer"
            >
              Ver todos →
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {distratosRecentes.map((proc) => {
              const divida = calcularDividaTotal(proc);
              return (
                <div
                  key={proc.id}
                  onClick={() => onVerDistrato(proc.id)}
                  className="p-4 hover:bg-stone-50/80 transition flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200/60">
                        {proc.id}
                      </span>
                      <StatusBadge status={proc.statusGeral} size="sm" />
                    </div>
                    <p className="text-xs font-semibold text-stone-800 truncate">
                      {proc.agregadoNome}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {proc.tipoDistrato} • Solicitado em {formatarData(proc.dataSolicitacao)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-stone-900 block">
                      {formatarMoeda(divida)}
                    </span>
                    <span className="text-[10px] text-stone-400 block">
                      {proc.statusFinanceiro}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
