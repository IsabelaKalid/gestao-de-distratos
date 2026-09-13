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

interface TarefasViewProps {
  onVerDetalhe: (id: string) => void;
}

export const TarefasView: React.FC<TarefasViewProps> = ({ onVerDetalhe }) => {
  const { distratos, usuarioAtual } = useDistratos();

  // Filtra as tarefas de acordo com o perfil atual
  const tarefas = useMemo(() => {
    return distratos
      .filter((d) => d.statusGeral !== 'Quitado' && d.statusGeral !== 'Cancelado')
      .map((d) => {
        let motivoPendencia = '';
        let itensArea: any[] = [];

        if (usuarioAtual.perfil === 'admin') {
          motivoPendencia = `Fila atual: ${d.responsavelAtualNome} • Status: ${d.statusGeral}`;
          itensArea = d.verificacoes.filter(
            (v) => v.status === 'Aguardando análise' || v.status === 'Em análise'
          );
        } else if (usuarioAtual.perfil === 'cadastro') {
          if (d.statusGeral === 'Aguardando Emissão' || d.statusGeral === 'Em Aberto') {
            motivoPendencia = 'Conferência inicial de cadastro e emissão de minuta de distrato';
          }
        } else if (usuarioAtual.perfil === 'manutencao') {
          itensArea = d.verificacoes.filter(
            (v) =>
              (v.tipo === 'manutencao' || v.tipo === 'pneus') &&
              (v.status === 'Aguardando análise' || v.status === 'Em análise')
          );
          if (itensArea.length > 0) {
            motivoPendencia = `Avaliar oficina e pneus (${itensArea.map((i) => i.titulo).join(', ')})`;
          }
        } else if (usuarioAtual.perfil === 'verificacoes') {
          itensArea = d.verificacoes.filter(
            (v) =>
              v.tipo !== 'manutencao' &&
              v.tipo !== 'pneus' &&
              (v.status === 'Aguardando análise' || v.status === 'Em análise')
          );
          if (itensArea.length > 0) {
            motivoPendencia = `${itensArea.length} verificação(ões) pendente(s) de auditoria de pátio`;
          }
        } else if (usuarioAtual.perfil === 'financeiro') {
          if (d.statusFinanceiro === 'Aguardando boleto') {
            motivoPendencia = 'Gerar boleto de cobrança com saldo consolidado';
          } else if (d.statusFinanceiro === 'Vencido') {
            motivoPendencia = 'Boleto vencido - Cobrar agregado ou encaminhar para protesto';
          } else if (d.statusFinanceiro === 'Parcialmente pago') {
            motivoPendencia = 'Acompanhar quitação de saldo residual';
          }
        } else if (usuarioAtual.perfil === 'juridico') {
          if (d.statusGeral === 'Em Protesto') {
            motivoPendencia = 'Acompanhar efetivação de protesto em cartório';
          } else if (d.statusGeral === 'Ajuizado') {
            motivoPendencia = 'Acompanhamento processual judicial da execução';
          } else if (d.statusFinanceiro === 'Vencido') {
            motivoPendencia = 'Analisar documentação para lavratura de protesto';
          }
        }

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
            <span>Transpanorama</span>
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
