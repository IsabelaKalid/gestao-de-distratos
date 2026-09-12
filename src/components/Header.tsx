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
import { useDistratos } from '../context/DistratoContext';
import { formatarDataHora } from '../utils/calculations';

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
    usuarios,
    usuarioAtual,
    trocarUsuario,
    notificacoes,
    marcarNotificacaoComoLida,
    marcarTodasNotificacoesLidas,
    selecionarDistrato,
  } = useDistratos();

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
        return 'Administrador';
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

  return (
    <header className="sticky top-0 z-50 bg-[#220609] border-b border-[#a87f3b]/30 text-white select-none shadow-md w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo e Nome do Sistema Transpanorama */}
          <div className="flex items-center gap-3">
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

            <div className="flex items-center gap-3">
              {/* Monograma TP estilizado inspirado na imagem */}
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#3d0f16] via-[#24070a] to-[#160305] border border-[#c59b4c]/50 flex items-center justify-center shadow-inner text-white font-black tracking-tighter">
                <span className="text-sm font-extrabold bg-gradient-to-r from-[#e7c784] via-[#c59b4c] to-[#f5ecd7] bg-clip-text text-transparent">
                  TP
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold tracking-wider text-stone-100 uppercase">
                    Transpanorama
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#3d0f16] text-[#dfc28d] border border-[#c59b4c]/30">
                    FROTAS
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 hidden sm:block">
                  Gestão Integrada de Distratos & Auditoria de Veículos
                </p>
              </div>
            </div>
          </div>

          {/* Ações Centrais / Direitas */}
          <div className="flex items-center gap-2 sm:gap-4">
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
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white text-stone-900 shadow-2xl border border-stone-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
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
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg hover:bg-[#340b10] transition text-left cursor-pointer border border-transparent hover:border-[#c59b4c]/30"
              >
                <img
                  src={usuarioAtual.avatar}
                  alt={usuarioAtual.nome}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-[#c59b4c]/40"
                  referrerPolicy="no-referrer"
                />
                <div className="hidden md:block">
                  <div className="text-xs font-bold text-stone-200 leading-tight flex items-center gap-1.5">
                    <span>{usuarioAtual.nome}</span>
                    <ChevronDown className="w-3 h-3 text-stone-400" />
                  </div>
                  <div className="text-[11px] font-medium text-[#dfc28d]">
                    {getPerfilLabel(usuarioAtual.perfil)}
                  </div>
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white text-stone-900 shadow-2xl border border-stone-200 z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3 bg-[#faf8f5] rounded-lg border border-stone-200/70 mb-2">
                    <p className="text-xs font-bold text-stone-800">{usuarioAtual.nome}</p>
                    <p className="text-[11px] text-stone-500">{usuarioAtual.email}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f5ede1] text-[#7e1d2c] text-[10px] font-bold border border-[#e5d4be]">
                      <Shield className="w-3 h-3" />
                      <span>{getPerfilLabel(usuarioAtual.perfil)}</span>
                    </div>
                  </div>

                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    Alternar Perfil para Teste:
                  </div>

                  <div className="space-y-1 my-1">
                    {usuarios.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          trocarUsuario(u.id);
                          setUserMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                          u.id === usuarioAtual.id
                            ? 'bg-[#fcf3f4] text-[#7e1d2c] font-bold border border-[#f5ccd3]'
                            : 'hover:bg-stone-100 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={u.avatar}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="truncate">{u.nome}</span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {getPerfilLabel(u.perfil)}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-stone-100 pt-2 mt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenLogin();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-stone-500" />
                      <span>Modal de Login / Troca de Perfil</span>
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
