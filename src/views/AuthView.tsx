import React, { useState } from 'react';
import { LockKeyhole, Mail, UserRound, Truck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthView: React.FC = () => {
  const { entrar, cadastrar, recuperarSenha } = useAuth();
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(''); setMensagem(''); setEnviando(true);
    try {
      const falha = modo === 'entrar' ? await entrar(email, senha) : await cadastrar(nome, email, senha);
      if (falha) setErro(falha);
      else if (modo === 'cadastrar') setMensagem('Cadastro realizado. Confirme seu e-mail e aguarde a aprovação de um administrador.');
    } finally { setEnviando(false); }
  };

  const recuperar = async () => {
    if (!email) { setErro('Informe seu e-mail primeiro.'); return; }
    setErro(''); setMensagem(''); setEnviando(true);
    try {
      const falha = await recuperarSenha(email);
      if (falha) setErro(falha); else setMensagem('Enviamos as instruções de recuperação para seu e-mail.');
    } finally { setEnviando(false); }
  };

  return <main className="min-h-screen bg-[#faf8f5] grid lg:grid-cols-[1.1fr_0.9fr]">
    <section className="hidden lg:flex bg-[#29080d] text-white p-14 flex-col justify-between">
      <div className="flex items-center gap-3"><Truck className="w-8 h-8 text-[#dfc28d]"/><span className="font-black text-xl">Gestão de Distratos</span></div>
      <div className="max-w-xl"><p className="text-[#dfc28d] font-semibold mb-3">Transpanorama Transportes</p><h1 className="text-4xl font-black leading-tight">Processos, auditorias e cobranças em um único lugar.</h1><p className="mt-5 text-stone-300">Acesse com sua conta individual. Todas as alterações ficam vinculadas ao usuário responsável.</p></div>
      <p className="text-xs text-stone-400">Acesso exclusivo para pessoas autorizadas.</p>
    </section>
    <section className="flex items-center justify-center p-3 sm:p-6"><div className="w-full max-w-md bg-white border border-stone-200 shadow-xl rounded-2xl p-5 sm:p-9">
      <div className="lg:hidden flex items-center gap-2 text-[#7e1d2c] mb-7"><Truck/><span className="font-black">Gestão de Distratos</span></div>
      <h2 className="text-2xl font-black text-stone-900">{modo === 'entrar' ? 'Entrar no sistema' : 'Criar sua conta'}</h2>
      <p className="text-sm text-stone-500 mt-1">{modo === 'entrar' ? 'Use seu e-mail e sua senha.' : 'Sua conta será analisada por um administrador.'}</p>
      <form onSubmit={enviar} className="mt-7 space-y-4">
        {modo === 'cadastrar' && <label className="block text-sm font-semibold text-stone-700">Nome completo<div className="mt-1.5 flex items-center border rounded-xl px-3"><UserRound className="w-4 h-4 text-stone-400 shrink-0"/><input required value={nome} onChange={e=>setNome(e.target.value)} className="w-full min-w-0 p-3 outline-none" placeholder="Seu nome"/></div></label>}
        <label className="block text-sm font-semibold text-stone-700">E-mail<div className="mt-1.5 flex items-center border rounded-xl px-3"><Mail className="w-4 h-4 text-stone-400 shrink-0"/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full min-w-0 p-3 outline-none" placeholder="nome@empresa.com.br"/></div></label>
        <label className="block text-sm font-semibold text-stone-700">Senha<div className="mt-1.5 flex items-center border rounded-xl px-3"><LockKeyhole className="w-4 h-4 text-stone-400 shrink-0"/><input required minLength={8} type="password" value={senha} onChange={e=>setSenha(e.target.value)} className="w-full min-w-0 p-3 outline-none" placeholder="No mínimo 8 caracteres"/></div></label>
        {erro && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{erro}</p>}
        {mensagem && <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">{mensagem}</p>}
        <button disabled={enviando} className="w-full flex justify-center items-center gap-2 bg-[#7e1d2c] hover:bg-[#681623] text-white font-bold rounded-xl p-3 disabled:opacity-60">{enviando && <Loader2 className="w-4 h-4 animate-spin"/>}{modo === 'entrar' ? 'Entrar' : 'Cadastrar'}</button>
      </form>
      {modo === 'entrar' && <button onClick={recuperar} className="mt-4 text-sm text-[#7e1d2c] hover:underline">Esqueci minha senha</button>}
      <div className="border-t mt-6 pt-6 text-sm text-stone-600">{modo === 'entrar' ? 'Ainda não possui conta?' : 'Já possui uma conta?'} <button onClick={()=>{setModo(modo === 'entrar' ? 'cadastrar' : 'entrar');setErro('');setMensagem('')}} className="font-bold text-[#7e1d2c] hover:underline">{modo === 'entrar' ? 'Criar conta' : 'Entrar'}</button></div>
    </div></section>
  </main>;
};
