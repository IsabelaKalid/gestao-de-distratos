import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { PerfilAcesso, Usuario } from '../types';

type UsuarioAutenticado = Usuario & { aprovado: boolean; ativo: boolean };
type AuthContextType = {
  session: Session | null;
  authUser: User | null;
  perfil: UsuarioAutenticado | null;
  carregando: boolean;
  erroPerfil: string | null;
  entrar: (email: string, senha: string) => Promise<string | null>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
  recuperarSenha: (email: string) => Promise<string | null>;
  atualizarPerfil: (id: string, dados: { perfil: string; departamento: string; cargo: string; aprovado: boolean; ativo: boolean }) => Promise<string | null>;
  recarregarPerfil: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const mapPerfil = (row: any): UsuarioAutenticado => ({
  id: row.id,
  nome: row.nome || row.email,
  email: row.email,
  perfil: row.perfil as PerfilAcesso,
  departamento: row.departamento || '',
  cargo: row.cargo || '',
  avatar: row.avatar_url || undefined,
  aprovado: row.aprovado,
  ativo: row.ativo,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<UsuarioAutenticado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);
  const requisicaoAtual = useRef(0);

  const carregarSessaoEPerfil = async (proximaSessao: Session | null) => {
    const requisicao = ++requisicaoAtual.current;
    setCarregando(true);
    setErroPerfil(null);
    setSession(proximaSessao);
    setPerfil(null);
    try {
      if (proximaSessao?.user) {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', proximaSessao.user.id).single();
        if (error) throw error;
        if (requisicao === requisicaoAtual.current) setPerfil(mapPerfil(data));
      }
    } catch {
      if (requisicao === requisicaoAtual.current) setErroPerfil('Não foi possível consultar seu perfil. Verifique a conexão e tente novamente.');
    } finally {
      if (requisicao === requisicaoAtual.current) setCarregando(false);
    }
  };

  useEffect(() => {
    let ativo = true;
    let eventoAuthRecebido = false;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!ativo || eventoAuthRecebido) return;
      if (error) throw error;
      void carregarSessaoEPerfil(data.session);
    }).catch(() => {
      if (ativo) { setErroPerfil('Não foi possível consultar sua sessão. Tente recarregar a página.'); setCarregando(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      eventoAuthRecebido = true;
      // O perfil é buscado fora do callback para não bloquear o cliente de autenticação.
      setCarregando(true);
      setTimeout(async () => {
        if (ativo) await carregarSessaoEPerfil(nextSession);
      }, 0);
    });
    return () => { ativo = false; requisicaoAtual.current++; listener.subscription.unsubscribe(); };
  }, []);

  const entrar = async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    return error?.message ?? null;
  };

  const cadastrar = async (nome: string, email: string, senha: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    return error?.message ?? null;
  };

  const sair = async () => { await supabase.auth.signOut(); };

  const recuperarSenha = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    return error?.message ?? null;
  };

  const atualizarPerfil = async (id: string, dados: { perfil: string; departamento: string; cargo: string; aprovado: boolean; ativo: boolean }) => {
    const { error } = await supabase.from('profiles').update(dados).eq('id', id);
    return error?.message ?? null;
  };

  const recarregarPerfil = async () => carregarSessaoEPerfil(session);

  return <AuthContext.Provider value={{ session, authUser: session?.user ?? null, perfil, carregando, erroPerfil, entrar, cadastrar, sair, recuperarSenha, atualizarPerfil, recarregarPerfil }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
