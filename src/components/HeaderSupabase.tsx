import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Truck,
  UserCheck,
  ChevronDown,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useDistratos } from '../context/SupabaseDistratoContext';
import { useAuth } from '../context/AuthContext';
import { formatarDataHora } from '../utils/calculations';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  onOpenLogin: () => void;
  onOpenNovoDistrato: () => void;
  onToggleSidebarMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLogin,
  onOpenNovoDistrato,
  onToggleSidebarMobile,
}) => {
  const {
    usuarioAtual,
    notificacoes,
    marcarNotificacaoComoLida,
    marcarTodasNotificacoesLidas,
    selecionarDistrato,
  } = useDistratos();
  const { sair } = useAuth();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const naoLidas = notificacoes.filter((n) => !n.lida);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPerfilLabel = (perfil: string) => {
    switch (perfil) {
      case 'admin':
        return 'Supervisor';
      case 'cadastro':
        return 'Cadastro e Gestão';
      case 'manutencao':
        return 'Resp. Manutenção';
      case 'verificacoes':
        return 'Auditoria Operacional';
      case 'financeiro':
        return 'Financeiro / Cobrança';
      case 'juridico':
        return 'Jurídico / Protestos';
      default:
        return perfil;
    }
  };

  const getIniciais = (nome: string) => {
    const partes = nome.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'US';

    const primeira = partes[0][0] ?? '';
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? '' : '';
    return `${primeira}${ultima}`.toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1c0407] via-[#250609] to-[#1c0407] border-b border-[#a87f3b]/25 text-white select-none shadow-md w-full max-w-[100vw]">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center h-16 gap-1 sm:gap-4 min-w-0">
          {/* Logo e Nome do Sistema */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onToggleSidebarMobile}
              className="lg:hidden p-2 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800/60 transition"
              aria-label="Abrir menu lateral"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-4 min-w-0">
              <BrandLogo size="sm" tagline className="min-w-0" />
              <div className="hidden xl:block h-8 w-px bg-white/10" />
              <p className="hidden xl:block text-[11px] leading-snug text-stone-400 max-w-[13rem]">
                Distratos, auditoria e cobrança de agregados
              </p>
            </div>
          </div>

          {/* Ações Centrais / Direitas */}
          <div className="flex items-center gap-0 sm:gap-3 shrink-0 min-w-0">
            {/* Botão Novo Distrato */}
            <button
              id="btn-novo-distrato-header"
              type="button"
              onClick={onOpenNovoDistrato}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#7e1d2c] hover:bg-[#681623] active:bg-[#56111b] border border-[#c59b4c]/40 text-stone-100 text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <span className="text-base leading-none font-bold text-[#dfc28d]">+</span>
              <span>Novo Distrato</span>
            </button>

            {/* Dropdown de Notificações */}
            <div className="relative" ref={notifRef}>
              <button
                id="btn-notificacoes"
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg text-stone-300 hover:text-white hover:bg-[#340b10] transition"
                title="Notificações do Sistema"
              >
                <Bell className="w-5 h-5" />
                {naoLidas.length > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#9e1c2e] text-[10px] font-bold text-white shadow-sm ring-1 ring-white/20">
                    {naoLidas.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="fixed left-2 right-2 top-16 mt-2 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:w-96 rounded-xl bg-white text-stone-900 shadow-2xl border border-stone-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 bg-[#fbf9f6] border-b border-stone-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-800">Notificações</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#f6ede0] text-[#865d1d] font-semibold border border-[#e8d2b2]">
                        {naoLidas.length} novas
                      </span>
                    </div>
                    {naoLidas.length > 0 && (
                      <button
                        type="button"
                        onClick={marcarTodasNotificacoesLidas}
                        className="text-xs text-[#7e1d2c] hover:text-[#5a1420] font-medium cursor-pointer"
                      >
                        Marcar lidas
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
                    {notificacoes.length === 0 ? (
                      <div className="p-6 text-center text-xs text-stone-500">
                        Nenhuma notificação registrada.
                      </div>
                    ) : (
                      notificacoes.slice(0, 8).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            marcarNotificacaoComoLida(notif.id);
                            if (notif.linkDistratoId) {
                              selecionarDistrato(notif.linkDistratoId);
                              setNotifOpen(false);
                            }
                          }}
                          className={`p-3.5 hover:bg-stone-50 transition cursor-pointer flex gap-3 ${
                            !notif.lida ? 'bg-[#fdfaf7]' : ''
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {notif.tipo === 'atraso' || notif.tipo === 'vencido' ? (
                              <div className="w-7 h-7 rounded-full bg-rose-100 text-[#8e192a] flex items-center justify-center">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            ) : notif.tipo === 'quitacao' ? (
                              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-semibold text-stone-900 truncate">
                                {notif.titulo}
                              </p>
                              <span className="text-[10px] text-stone-400 shrink-0">
                                {formatarDataHora(notif.dataHora).split('às')[1] || ''}
                              </span>
                            </div>
                            <p className="text-xs text-stone-600 mt-0.5 line-clamp-2">
                              {notif.mensagem}
                            </p>
                            {notif.linkDistratoId && (
                              <span className="inline-block mt-1 text-[10px] font-semibold text-[#7e1d2c] hover:underline">
                                Ver {notif.linkDistratoId} →
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Menu de Perfil / Alternador de Papéis */}
            <div className="relative" ref={userMenuRef}>
              <button
                id="btn-usuario-menu"
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-lg hover:bg-[#340b10] transition text-left cursor-pointer border border-transparent hover:border-[#c59b4c]/30 shrink-0"
              >
                <div
                  className="w-8 h-8 rounded-full bg-[#f5ede1] text-[#7e1d2c] ring-2 ring-[#c59b4c]/50 flex items-center justify-center text-[11px] font-black tracking-wide shrink-0"
                  aria-label={`Usuário ${usuarioAtual.nome}`}
                  title={usuarioAtual.nome}
                >
                  {getIniciais(usuarioAtual.nome)}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-bold text-stone-200 leading-tight flex items-center gap-1.5">
                    <span>{usuarioAtual.nome}</span>
                    <ChevronDown className="w-3 h-3 text-stone-400" />
                  </div>
                  <div className="text-[11px] font-medium text-[#dfc28d]">
                    {usuarioAtual.cargo || getPerfilLabel(usuarioAtual.perfil)}
                  </div>
                </div>
              </button>

              {userMenuOpen && (
                <div className="fixed left-2 right-2 top-16 mt-2 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:w-72 rounded-xl bg-white text-stone-900 shadow-2xl border border-stone-200 z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3 bg-[#faf8f5] rounded-lg border border-stone-200/70 mb-2">
                    <p className="text-xs font-bold text-stone-800">{usuarioAtual.nome}</p>
                    <p className="text-[11px] text-stone-500">{usuarioAtual.email}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f5ede1] text-[#7e1d2c] text-[10px] font-bold border border-[#e5d4be]">
                      <Shield className="w-3 h-3" />
                      <span>{usuarioAtual.cargo || getPerfilLabel(usuarioAtual.perfil)}</span>
                    </div>
                  </div>

                  <div className="border-t border-stone-100 pt-2 mt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); sair(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-stone-500" />
                      <span>Sair da conta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
