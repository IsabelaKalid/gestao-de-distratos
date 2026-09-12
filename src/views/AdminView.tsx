import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, RefreshCw, Shield, Users } from 'lucide-react';
import { useDistratos } from '../context/DistratoContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Usuario } from '../types';

type UsuarioAdmin = Usuario & { aprovado?: boolean; ativo?: boolean };
const PERFIS = ['pendente','admin','cadastro','manutencao','verificacoes','financeiro','juridico'];

export const AdminView: React.FC = () => {
  const { usuarioAtual, resetarDados, distratos, erroDados } = useDistratos();
  const { atualizarPerfil } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [mensagem, setMensagem] = useState('');

  const carregarUsuarios = async () => {
    const { data } = await supabase.from('profiles').select('*').order('criado_em', { ascending: false });
    setUsuarios((data || []).map((u:any)=>({ id:u.id,nome:u.nome,email:u.email,perfil:u.perfil,departamento:u.departamento||'',cargo:u.cargo||'',aprovado:u.aprovado,ativo:u.ativo })));
  };
  useEffect(()=>{ carregarUsuarios(); },[]);

  const salvar = async (u: UsuarioAdmin) => {
    const erro = await atualizarPerfil(u.id,{ perfil:u.perfil,departamento:u.departamento,cargo:u.cargo,aprovado:Boolean(u.aprovado),ativo:u.ativo !== false });
    setMensagem(erro ? `Não foi possível salvar: ${erro}` : `Perfil de ${u.nome} atualizado.`);
    if (!erro) carregarUsuarios();
  };
  const alterar = (id:string, campo:keyof UsuarioAdmin, valor:any) => setUsuarios(prev=>prev.map(u=>u.id===id?{...u,[campo]:valor}:u));
  const importar = () => {
    if (distratos.length && !window.confirm('Já existem distratos no banco. A importação atualizará os registros com os dados iniciais. Continuar?')) return;
    resetarDados();
    setMensagem('Importação iniciada. Aguarde alguns segundos para a sincronização com o Supabase.');
  };
  if (usuarioAtual.perfil !== 'admin') return null;

  return <div className="space-y-6 pb-12 max-w-6xl">
    <div><p className="text-xs font-semibold text-[#865d1d]">Governança e acessos</p><h1 className="text-xl sm:text-2xl font-black mt-1">Administração do sistema</h1><p className="text-sm text-stone-500 mt-1">Aprove novos cadastros e determine o perfil de cada pessoa.</p></div>
    {mensagem && <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-900">{mensagem}</div>}
    {erroDados && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">Erro de sincronização: {erroDados}</div>}
    <section className="card-gradient-hover bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b flex items-center gap-2"><Users className="w-5 h-5 text-[#7e1d2c]"/><h2 className="font-bold">Usuários cadastrados</h2></div>
      <div className="divide-y">{usuarios.map(u=><div key={u.id} className="p-4 sm:p-5 grid lg:grid-cols-[1.3fr_1fr_1fr_auto] gap-3 items-end">
        <div className="min-w-0"><p className="font-bold text-sm break-words">{u.nome}</p><p className="text-xs text-stone-500 break-all">{u.email}</p></div>
        <label className="text-xs font-semibold">Perfil<select value={String(u.perfil)} onChange={e=>alterar(u.id,'perfil',e.target.value as any)} className="mt-1 block w-full border rounded-lg p-2 bg-white">{PERFIS.map(p=><option key={p}>{p}</option>)}</select></label>
        <label className="text-xs font-semibold">Departamento<input value={u.departamento} onChange={e=>alterar(u.id,'departamento',e.target.value)} className="mt-1 block w-full border rounded-lg p-2" placeholder="Ex.: Manutenção"/></label>
        <div className="flex flex-wrap items-center justify-between lg:justify-start gap-2"><label className="text-xs flex items-center gap-1.5"><input type="checkbox" checked={Boolean(u.aprovado)} onChange={e=>alterar(u.id,'aprovado',e.target.checked)}/>Aprovado</label><button onClick={()=>salvar(u)} className="px-4 py-2 rounded-lg bg-[#7e1d2c] text-white text-xs font-bold">Salvar</button></div>
      </div>)}{!usuarios.length && <p className="p-6 text-sm text-stone-500">Nenhum usuário encontrado.</p>}</div>
    </section>
    <section className="card-gradient-hover bg-white rounded-2xl border border-stone-200 p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
      <div><div className="flex items-center gap-2"><Database className="w-5 h-5"/><h2 className="font-bold">Dados iniciais</h2></div><p className="text-sm text-stone-500 mt-1">Exibindo {distratos.length} distratos carregados do banco de dados.</p></div>
      <button onClick={importar} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#7e1d2c] text-[#7e1d2c] font-bold text-sm"><RefreshCw className="w-4 h-4"/>Importar dados iniciais</button>
    </section>
    <section className="grid md:grid-cols-2 gap-4"><div className="card-gradient-hover bg-white border rounded-2xl p-5"><Shield className="text-[#865d1d]"/><h3 className="font-bold mt-3">Contas individuais</h3><p className="text-sm text-stone-500 mt-1">Cada alteração usa o usuário autenticado, sem alternância de nomes.</p></div><div className="card-gradient-hover bg-white border rounded-2xl p-5"><CheckCircle2 className="text-emerald-600"/><h3 className="font-bold mt-3">Aprovação administrativa</h3><p className="text-sm text-stone-500 mt-1">Novas contas permanecem bloqueadas até receberem perfil e aprovação.</p></div></section>
  </div>;
};
