import React from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  CheckSquare,
  Settings,
  PlusCircle,
  X,
} from "lucide-react";
import { useDistratos } from "../context/SupabaseDistratoContext";
import type { AbaSistema } from "../types";
import { EMPRESA } from "../config/empresa";

interface SidebarProps {
  abaAtiva: AbaSistema;
  onChangeAba: (aba: AbaSistema) => void;
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
    if (d.statusGeral === "Finalizado" || d.statusGeral === "Cancelado")
      return false;

    if (usuarioAtual.perfil === "admin") {
      return true; // vê todas
    }
    if (usuarioAtual.perfil === "cadastro") {
      return (
        d.statusGeral === "Aguardando Emissão" || d.statusGeral === "Em Aberto"
      );
    }
    if (usuarioAtual.perfil === "manutencao") {
      return d.verificacoes.some(
        (v) =>
          (v.tipo === "manutencao" || v.tipo === "pneus") &&
          (v.status === "Aguardando análise" || v.status === "Em análise"),
      );
    }
    if (usuarioAtual.perfil === "verificacoes") {
      return d.verificacoes.some(
        (v) =>
          v.tipo !== "manutencao" &&
          v.tipo !== "pneus" &&
          (v.status === "Aguardando análise" || v.status === "Em análise"),
      );
    }
    if (usuarioAtual.perfil === "financeiro") {
      return (
        d.statusFinanceiro === "Aguardando boleto" ||
        d.statusFinanceiro === "Vencido" ||
        d.statusFinanceiro === "A vencer" ||
        d.statusFinanceiro === "Parcialmente pago"
      );
    }
    if (usuarioAtual.perfil === "juridico") {
      return (
        d.statusGeral === "Em Protesto" ||
        d.statusGeral === "Ajuizado" ||
        d.statusFinanceiro === "Vencido"
      );
    }
    return false;
  }).length;

  const perfil = usuarioAtual.perfil;
  const departamentos =
    usuarioAtual.departamentos ||
    (usuarioAtual.departamento ? [usuarioAtual.departamento] : []);
  const temDepartamento = (...nomes: string[]) =>
    perfil === "admin" || nomes.some((nome) => departamentos.includes(nome));
  const itensNav: Array<{
    id: AbaSistema;
    label: string;
    descricao: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: string;
    permitido: boolean;
  }> = [
    {
      id: "dashboard" as const,
      label: "Painel Geral",
      descricao: "Visão executiva & KPIs",
      icon: LayoutDashboard,
      permitido: true,
    },
    {
      id: "lista" as const,
      label: "Distratos",
      descricao: "Processos, busca e relatórios",
      icon: FileSpreadsheet,
      badge: distratos.length,
      permitido: true,
    },
    {
      id: "tarefas" as const,
      label: "Minhas Tarefas",
      descricao: `Ações do perfil (${usuarioAtual.perfil === "admin" ? "supervisor" : usuarioAtual.perfil})`,
      icon: CheckSquare,
      badge: tarefasPendentes,
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      permitido: true,
    },
    {
      id: "admin" as const,
      label: "Supervisão",
      descricao: "Usuários & Permissões",
      icon: Settings,
      permitido: perfil === "admin",
    },
  ].filter((item) => item.permitido);

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
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-[#faf8f5] border-r border-stone-200 transform transition-transform duration-200 ease-in-out lg:sticky lg:top-16 lg:self-start lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:z-30 lg:shrink-0 flex flex-col justify-between overflow-y-auto ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Header Mobile com botão fechar */}
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-stone-200">
            <span className="font-bold text-stone-800 text-sm">Menu</span>
            <button
              onClick={onCloseMobile}
              className="p-1 rounded text-stone-400 hover:text-stone-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Botão Novo Distrato Principal */}
          {(usuarioAtual.perfil === "admin" ||
            usuarioAtual.perfil === "cadastro" ||
            temDepartamento("Logística")) && (
            <button
              id="btn-novo-distrato-sidebar"
              type="button"
              onClick={() => {
                onOpenNovoDistrato();
                if (isOpenMobile) onCloseMobile();
              }}
              className="sidebar-primary-action w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-stone-50 font-semibold text-sm shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#f0d48f]" />
              <span>Novo distrato</span>
            </button>
          )}

          {/* Menu de Navegação */}
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold tracking-[0.16em] text-stone-400 uppercase">
              Menu principal
            </div>

            {itensNav.map((item) => {
              const Icon = item.icon;
              const ativo = abaAtiva === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  type="button"
                  aria-current={ativo ? "page" : undefined}
                  onClick={() => {
                    onChangeAba(item.id);
                    selecionarDistrato(null); // Volta para a tela principal da aba
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`sidebar-nav-item w-full flex items-center gap-3 h-14 px-3 rounded-xl text-left cursor-pointer ${
                    ativo
                      ? "sidebar-nav-item-active text-stone-50"
                      : "text-stone-700"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      ativo
                        ? "bg-white/10 text-[#f0d48f]"
                        : "bg-white border border-stone-200 text-[#7e1d2c]"
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight truncate">
                      {item.label}
                    </span>
                    <span
                      className={`block mt-0.5 text-[11px] leading-tight truncate ${
                        ativo ? "text-stone-300" : "text-stone-500"
                      }`}
                    >
                      {item.descricao}
                    </span>
                  </span>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`min-w-6 h-6 px-1.5 inline-flex items-center justify-center text-[11px] font-bold rounded-full shrink-0 ${
                        ativo
                          ? "bg-[#d9b86f] text-[#29080d]"
                          : item.badgeColor
                            ? "bg-amber-100 text-amber-800"
                            : "bg-stone-200 text-stone-700"
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

        {/* Rodapé do Sidebar */}
        <div className="p-4 border-t border-stone-200/70">
          <div className="flex items-center gap-3 rounded-xl bg-white border border-stone-200 px-3 py-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-stone-700 leading-tight">Sistema operacional</p>
              <p className="text-[11px] text-stone-400 leading-tight mt-0.5 truncate">
                {EMPRESA.nome} · versão 2.4
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
