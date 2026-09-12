import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  CheckSquare,
  Settings,
  PlusCircle,
  AlertCircle,
  Truck,
  FileText,
  HelpCircle,
  X,
} from 'lucide-react';
import { useDistratos } from '../context/SupabaseDistratoContext';

interface SidebarProps {
  abaAtiva: 'dashboard' | 'lista' | 'tarefas' | 'admin';
  onChangeAba: (aba: 'dashboard' | 'lista' | 'tarefas' | 'admin') => void;
  onOpenNovoDistrato: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  abaAtiva,
  onChangeAba,
  onOpenNovoDistrato,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { distratos, usuarioAtual, selecionarDistrato } = useDistratos();

  // Contagem de tarefas para o perfil logado
  const tarefasPendentes = distratos.filter((d) => {
    if (d.statusGeral === 'Quitado' || d.statusGeral === 'Cancelado') return false;

    if (usuarioAtual.perfil === 'admin') {
      return true; // vê todas
    }
    if (usuarioAtual.perfil === 'cadastro') {
      return d.statusGeral === 'Aguardando Emissão' || d.statusGeral === 'Em Aberto';
    }
    if (usuarioAtual.perfil === 'manutencao') {
      return d.verificacoes.some(
        (v) => (v.tipo === 'manutencao' || v.tipo === 'pneus') &&
        (v.status === 'Aguardando análise' || v.status === 'Em análise')
      );
    }
    if (usuarioAtual.perfil === 'verificacoes') {
      return d.verificacoes.some(
        (v) =>
          v.tipo !== 'manutencao' &&
          v.tipo !== 'pneus' &&
          (v.status === 'Aguardando análise' || v.status === 'Em análise')
      );
    }
    if (usuarioAtual.perfil === 'financeiro') {
      return (
        d.statusFinanceiro === 'Aguardando boleto' ||
        d.statusFinanceiro === 'Vencido' ||
        d.statusFinanceiro === 'A vencer' ||
        d.statusFinanceiro === 'Parcialmente pago'
      );
    }
    if (usuarioAtual.perfil === 'juridico') {
      return (
        d.statusGeral === 'Em Protesto' ||
        d.statusGeral === 'Ajuizado' ||
        d.statusFinanceiro === 'Vencido'
      );
    }
    return false;
  }).length;

  const itensNav = [
    {
      id: 'dashboard' as const,
      label: 'Painel Geral',
      descricao: 'Visão executiva & KPIs',
      icon: LayoutDashboard,
    },
    {
      id: 'lista' as const,
      label: 'Distratos de Frotas',
      descricao: 'Base central de processos',
      icon: FileSpreadsheet,
      badge: distratos.length,
    },
    {
      id: 'tarefas' as const,
      label: 'Minhas Tarefas',
      descricao: `Ações do perfil (${usuarioAtual.perfil})`,
      icon: CheckSquare,
      badge: tarefasPendentes,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    {
      id: 'admin' as const,
      label: 'Administração',
      descricao: 'Permissões & Auditoria',
      icon: Settings,
    },
  ].filter((item) => item.id !== 'admin' || usuarioAtual.perfil === 'admin');

  return (
    <>
      {/* Backdrop Mobile */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 top-16 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-[#fcfbf9] border-r border-stone-200 transform transition-transform duration-200 ease-in-out lg:sticky lg:top-16 lg:self-start lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:z-30 lg:shrink-0 flex flex-col justify-between overflow-y-auto ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-5">
          {/* Header Mobile com botão fechar */}
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#7e1d2c]" />
              <span className="font-bold text-stone-800 text-sm">Navegação</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1 rounded text-stone-400 hover:text-stone-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Botão Novo Distrato Principal */}
          {(usuarioAtual.perfil === 'admin' || usuarioAtual.perfil === 'cadastro') && <button
            id="btn-novo-distrato-sidebar"
            type="button"
            onClick={() => {
              onOpenNovoDistrato();
              if (isOpenMobile) onCloseMobile();
            }}
            className="sidebar-primary-action w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#7e1d2c] active:bg-[#54101a] text-stone-100 font-semibold text-xs border border-[#c59b4c]/30 shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#dfc28d]" />
            <span>Cadastrar Novo Distrato</span>
          </button>}

          {/* Menu de Navegação */}
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
              Módulos do Sistema
            </div>

            {itensNav.map((item) => {
              const Icon = item.icon;
              const ativo = abaAtiva === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  type="button"
                  onClick={() => {
                    onChangeAba(item.id);
                    selecionarDistrato(null); // Volta para a tela principal da aba
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`sidebar-nav-item w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                    ativo
                      ? 'sidebar-nav-item-active bg-[#29080d] text-stone-100 shadow-sm font-semibold border-l-3 border-[#c59b4c]'
                      : 'text-stone-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${ativo ? 'text-[#dfc28d]' : 'text-stone-400'}`} />
                    <div className="min-w-0">
                      <div className="text-xs leading-tight truncate">{item.label}</div>
                      <div
                        className={`sidebar-nav-description text-[10px] truncate ${
                          ativo ? 'text-stone-300' : 'text-stone-400'
                        }`}
                      >
                        {item.descricao}
                      </div>
                    </div>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        ativo
                          ? 'bg-[#7e1d2c] text-stone-100 border-[#9e273a]'
                          : item.badgeColor || 'bg-stone-200/80 text-stone-700 border-stone-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé do Sidebar com informações operacionais */}
        <div className="p-4 border-t border-stone-200/70 bg-[#f7f5f2] space-y-3">
          <div className="card-gradient-hover rounded-lg p-3 bg-white border border-stone-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <span>Status Operacional</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
              Transpanorama Transportes • Auditorias ativas.
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-400 px-1">
            <span>Versão 2.4 Enterprise</span>
            <span>Maringá - PR</span>
          </div>
        </div>
      </aside>
    </>
  );
};
