import React, { useMemo } from 'react';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Truck,
  Eye,
  UserCheck,
  ChevronRight,
  Filter,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useDistratos } from '../context/SupabaseDistratoContext';
import {
  formatarMoeda,
  formatarData,
  calcularDividaTotal,
  calcularSaldoRestante,
} from '../utils/calculations';
import { StatusBadge } from '../components/StatusBadge';
import { EMPRESA } from '../config/empresa';

interface TarefasViewProps {
  onVerDetalhe: (id: string) => void;
}

export const TarefasView: React.FC<TarefasViewProps> = ({ onVerDetalhe }) => {
  const { distratos, usuarioAtual } = useDistratos();

  // Filtra as tarefas de acordo com o perfil atual
  const tarefas = useMemo(() => {
    const departamentos = usuarioAtual.departamentos || (usuarioAtual.departamento ? [usuarioAtual.departamento] : []);
    const pertence = (...nomes: string[]) => nomes.some((nome) => departamentos.includes(nome));
    const tiposPorDepartamento: Record<string, string[]> = {
      'Logística': ['aluguel_equipamento'],
      'Oficina': ['manutencao', 'sinistro'],
      'Multa': ['multas'],
      'Abastecimento': ['abastecimento'],
      'Customer Service': ['estadia', 'antt'],
      'Tecnologia Integrada': ['camera_rastreador'],
      'Estacionamento': ['estacionamento'],
      'Almoxarifado': ['pneus'],
      'Auditoria de Suprimentos': ['suprimentos'],
      'Auditoria': ['perda_carga', 'suprimentos'],
    };
    const tiposPermitidos = new Set(departamentos.flatMap((departamento) => tiposPorDepartamento[departamento] || []));

    return distratos
      .filter((d) => d.statusGeral !== 'Quitado' && d.statusGeral !== 'Cancelado')
      .map((d) => {
        const motivos: string[] = [];
        let itensArea: any[] = [];
        const pendente = (status: string) => status === 'Aguardando análise' || status === 'Em análise';

        if (usuarioAtual.perfil === 'admin') {
          motivos.push(`Fila atual: ${d.responsavelAtualNome} • Status: ${d.statusGeral}`);
          itensArea = d.verificacoes.filter((v) => pendente(v.status));
        } else {
          if (tiposPermitidos.size > 0) {
            itensArea = d.verificacoes.filter((v) => tiposPermitidos.has(v.tipo) && pendente(v.status));
            if (itensArea.length) motivos.push(`${itensArea.length} verificação(ões) do seu departamento`);
          }

        if (usuarioAtual.perfil === 'cadastro' || pertence('Logística')) {
          if (d.statusGeral === 'Aguardando Emissão' || d.statusGeral === 'Em Aberto') {
            motivos.push('Conferência inicial do cadastro e do encerramento');
          }
        }
        if (usuarioAtual.perfil === 'manutencao') {
          const itensPerfil = d.verificacoes.filter(
            (v) =>
              (v.tipo === 'manutencao' || v.tipo === 'pneus') &&
              pendente(v.status)
          );
          itensArea = [...new Map([...itensArea, ...itensPerfil].map((item) => [item.id, item])).values()];
          if (itensPerfil.length > 0) {
            motivos.push('Avaliar oficina e pneus');
          }
        }
        if (usuarioAtual.perfil === 'verificacoes') {
          const itensPerfil = d.verificacoes.filter(
            (v) =>
              v.tipo !== 'manutencao' &&
              v.tipo !== 'pneus' &&
              pendente(v.status)
          );
          itensArea = [...new Map([...itensArea, ...itensPerfil].map((item) => [item.id, item])).values()];
          if (itensPerfil.length > 0) {
            motivos.push(`${itensPerfil.length} verificação(ões) pendente(s)`);
          }
        }
        if (usuarioAtual.perfil === 'financeiro' || pertence('Financeiro')) {
          if (d.statusFinanceiro === 'Aguardando boleto') {
            motivos.push('Gerar boleto de cobrança com saldo consolidado');
          } else if (d.statusFinanceiro === 'Vencido') {
            motivos.push('Boleto vencido — acompanhar cobrança');
          } else if (d.statusFinanceiro === 'Parcialmente pago') {
            motivos.push('Acompanhar quitação do saldo residual');
          }
        }
        if (usuarioAtual.perfil === 'juridico' || pertence('Jurídico')) {
          if (d.statusGeral === 'Em Protesto') {
            motivos.push('Acompanhar protesto em cartório');
          } else if (d.statusGeral === 'Ajuizado') {
            motivos.push('Acompanhamento da execução judicial');
          } else if (d.statusFinanceiro === 'Vencido') {
            motivos.push('Analisar documentação para protesto');
          }
        }
        }

        const motivoPendencia = motivos.join(' • ');

        return {
          distrato: d,
          motivoPendencia,
          itensArea,
          temPendencia: Boolean(motivoPendencia || itensArea.length > 0),
        };
      })
      .filter((t) => t.temPendencia);
  }, [distratos, usuarioAtual]);

  return (
    <div className="space-y-6 pb-12">
      {/* Topo do Módulo de Tarefas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#865d1d]">
            <span>Fluxo de Trabalho Departamental</span>
            <span>•</span>
            <span>{EMPRESA.nome}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mt-0.5">
            Minha Fila de Responsabilidades
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Visualizando pendências designadas ao perfil logado:{' '}
            <strong className="text-stone-800">{usuarioAtual.nome} ({usuarioAtual.perfil === 'admin' ? 'supervisor' : usuarioAtual.perfil})</strong>
          </p>
        </div>

      </div>

      {/* Lista de Processos Pendentes da Área */}
      <div className="space-y-3">
        {tarefas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-stone-900">
              Nenhuma pendência na sua fila no momento!
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
              Todos os processos designados para o perfil <strong>{usuarioAtual.perfil}</strong> estão em dia ou foram concluídos.
            </p>
          </div>
        ) : (
          tarefas.map(({ distrato: proc, motivoPendencia, itensArea }) => {
            const saldo = calcularSaldoRestante(proc);
            return (
              <div
                key={proc.id}
                onClick={() => onVerDetalhe(proc.id)}
                className="card-gradient-hover bg-white rounded-2xl border border-stone-200/80 shadow-2xs hover:border-[#c59b4c] hover:shadow-md transition p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 group-hover:bg-[#f5ebd7] px-2.5 py-0.5 rounded border border-stone-200/60 transition">
                      {proc.id}
                    </span>
                    <StatusBadge status={proc.statusGeral} size="sm" />
                    <StatusBadge status={proc.statusFinanceiro} size="sm" />
                    <span className="text-[11px] text-stone-400">
                      Placa: <strong className="font-mono text-stone-700">{proc.placaCavalo}</strong>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-stone-900 group-hover:text-[#7e1d2c] transition truncate">
                      {proc.agregadoNome}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[#7e1d2c] font-semibold mt-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{motivoPendencia}</span>
                    </div>
                  </div>

                  {itensArea.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {itensArea.map((item) => (
                        <span
                          key={item.id}
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200"
                        >
                          {item.titulo}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block">
                      Saldo Aberto
                    </span>
                    <span className="font-mono font-bold text-sm text-stone-900 block">
                      {formatarMoeda(saldo)}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#7e1d2c] group-hover:translate-x-0.5 transition">
                    <span>Resolver Pendência</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
