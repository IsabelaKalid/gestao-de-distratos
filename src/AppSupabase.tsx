import React, { useState } from 'react';
import { DistratoProvider, useDistratos } from './context/SupabaseDistratoContext';
import { Header } from './components/HeaderSupabase';
import { Sidebar } from './components/SidebarSupabase';
import { NovoDistratoModal } from './components/NovoDistratoModal';
import { RelatorioImpressaoModal } from './components/RelatorioImpressaoModal';
import { DashboardView } from './views/DashboardView';
import { ListaDistratosView } from './views/ListaDistratosView';
import { DetalheDistratoView } from './views/DetalheDistratoView';
import { TarefasView } from './views/TarefasSupabaseView';
import { AdminView } from './views/AdminView';
import { ModuloOperacionalView } from './views/ModuloOperacionalView';
import { AbaSistema, Distrato } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './views/AuthView';
import { Loader2, ShieldAlert } from 'lucide-react';

function AppContent() {
  const { distratos, distratoSelecionadoId, selecionarDistrato, estadoSalvamento, erroDados, carregandoDados, tentarSalvarNovamente } = useDistratos();
  const { perfil } = useAuth();
  const exibirStatus = perfil?.perfil === 'admin' || carregandoDados || estadoSalvamento !== 'salvo' || Boolean(erroDados);

  // Abas de navegação principais
  const [abaAtiva, setAbaAtiva] = useState<AbaSistema>('dashboard');

  // Controle de Sidebar responsivo em dispositivos móveis
  const [sidebarMobileAberto, setSidebarMobileAberto] = useState(false);

  // Modais globais
  const [modalNovoDistratoAberto, setModalNovoDistratoAberto] = useState(false);
  const [distratoParaImprimir, setDistratoParaImprimir] = useState<Distrato | null>(null);

  // Manipulador para abrir detalhe do distrato
  const handleVerDistrato = (id: string) => {
    selecionarDistrato(id);
  };

  // Manipulador para voltar da tela de detalhes
  const handleVoltarDaDetalhe = () => {
    selecionarDistrato(null);
  };

  // Obter o objeto do distrato selecionado se houver
  const distratoSelecionado = distratos.find((d) => d.id === distratoSelecionadoId);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#faf8f5] text-stone-900 flex flex-col font-sans">
      {/* Header Corporativo */}
      <Header
        onOpenLogin={() => setAbaAtiva('admin')}
        onOpenNovoDistrato={() => setModalNovoDistratoAberto(true)}
        onToggleSidebarMobile={() => setSidebarMobileAberto((prev) => !prev)}
      />

      {exibirStatus && <div role={estadoSalvamento === 'erro' || (erroDados && !carregandoDados) ? 'alert' : 'status'} aria-live="polite" className={`px-4 py-2 text-center text-sm font-semibold ${estadoSalvamento === 'erro' || (erroDados && !carregandoDados) ? 'bg-red-100 text-red-900' : estadoSalvamento === 'salvando' || carregandoDados ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
        {carregandoDados ? 'Carregando distratos do banco de dados…' : estadoSalvamento === 'erro' ? (
          <>Alterações de distratos não salvas{erroDados ? `: ${erroDados}` : '.'} Não feche esta página. <button type="button" onClick={tentarSalvarNovamente} className="underline font-bold">Tentar novamente</button></>
        ) : erroDados ? `Falha ao consultar ou sincronizar dados: ${erroDados}` : estadoSalvamento === 'salvando' ? 'Salvando alterações de distratos no banco… Não feche esta página.' : 'Distratos sincronizados com o banco de dados.'}
      </div>}

      {/* Layout com Sidebar e Área Principal de Conteúdo */}
      <div className="flex-1 flex max-w-7xl w-full min-w-0 mx-auto items-start">
        {/* Barra Lateral de Navegação */}
        <Sidebar
          abaAtiva={abaAtiva}
          onChangeAba={(aba) => {
            setAbaAtiva(aba);
            selecionarDistrato(null);
          }}
          onOpenNovoDistrato={() => setModalNovoDistratoAberto(true)}
          isOpenMobile={sidebarMobileAberto}
          onCloseMobile={() => setSidebarMobileAberto(false)}
        />

        {/* Conteúdo Principal */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {distratoSelecionadoId ? (
            /* Visualização Detalhada do Processo Individual de Distrato */
            <DetalheDistratoView
              distratoId={distratoSelecionadoId}
              onVoltar={handleVoltarDaDetalhe}
              onOpenImprimir={() => {
                if (distratoSelecionado) {
                  setDistratoParaImprimir(distratoSelecionado);
                }
              }}
            />
          ) : (
            /* Visualizações por Módulo */
            <>
              {abaAtiva === 'dashboard' && (
                <DashboardView
                  onVerDistrato={handleVerDistrato}
                  onVerTodosDistratos={() => setAbaAtiva('lista')}
                  onOpenNovoDistrato={() => setModalNovoDistratoAberto(true)}
                />
              )}

              {abaAtiva === 'lista' && (
                <ListaDistratosView
                  onVerDetalhe={handleVerDistrato}
                  onOpenNovoDistrato={() => setModalNovoDistratoAberto(true)}
                  onOpenImprimir={(d) => setDistratoParaImprimir(d)}
                />
              )}

              {abaAtiva === 'tarefas' && (
                <TarefasView onVerDetalhe={handleVerDistrato} />
              )}

              {(['financeiro','juridico','documentos','auditoria','relatorios'] as const).includes(abaAtiva as any) && (
                <ModuloOperacionalView
                  modulo={abaAtiva as 'financeiro' | 'juridico' | 'documentos' | 'auditoria' | 'relatorios'}
                  onVerDetalhe={handleVerDistrato}
                  onImprimir={(d) => setDistratoParaImprimir(d)}
                />
              )}

              {abaAtiva === 'admin' && <AdminView />}
            </>
          )}
        </main>
      </div>

      {/* Modal de Cadastro de Novo Distrato */}
      <NovoDistratoModal
        isOpen={modalNovoDistratoAberto}
        onClose={() => setModalNovoDistratoAberto(false)}
        onSuccess={(novoId) => {
          selecionarDistrato(novoId);
          setModalNovoDistratoAberto(false);
        }}
      />

      {/* Modal de Impressão de Relatório Oficial e Termo */}
      {distratoParaImprimir && (
        <RelatorioImpressaoModal
          distrato={distratoParaImprimir}
          isOpen={Boolean(distratoParaImprimir)}
          onClose={() => setDistratoParaImprimir(null)}
        />
      )}
    </div>
  );
}

function AppGate() {
  const { session, perfil, carregando, erroPerfil, recuperandoSenha, recarregarPerfil, sair } = useAuth();
  if (recuperandoSenha) return <AuthView />;
  if (carregando) return <div className="min-h-screen grid place-items-center bg-[#faf8f5]"><Loader2 className="w-8 h-8 text-[#7e1d2c] animate-spin" /></div>;
  if (erroPerfil) return <div className="min-h-screen grid place-items-center bg-[#faf8f5] p-6"><div role="alert" className="max-w-md bg-white border rounded-2xl shadow-lg p-8 text-center"><ShieldAlert className="w-10 h-10 mx-auto text-amber-600"/><h1 className="text-xl font-black mt-4">Não foi possível carregar seu acesso</h1><p className="text-sm text-stone-600 mt-2">{erroPerfil}</p><button type="button" onClick={() => void recarregarPerfil()} className="mt-6 px-4 py-2 rounded-xl border font-semibold">Tentar novamente</button></div></div>;
  if (!session) return <AuthView />;
  if (!perfil?.aprovado || !perfil.ativo || String(perfil.perfil) === 'pendente') return <div className="min-h-screen grid place-items-center bg-[#faf8f5] p-6"><div className="max-w-md bg-white border rounded-2xl shadow-lg p-8 text-center"><ShieldAlert className="w-10 h-10 mx-auto text-amber-600"/><h1 className="text-xl font-black mt-4">Conta aguardando aprovação</h1><p className="text-sm text-stone-600 mt-2">Seu cadastro foi recebido. Um supervisor precisa definir seu perfil antes do primeiro acesso.</p><button onClick={sair} className="mt-6 px-4 py-2 rounded-xl border font-semibold">Sair</button></div></div>;
  return <DistratoProvider><AppContent /></DistratoProvider>;
}

export default function App() {
  return <AuthProvider><AppGate /></AuthProvider>;
}
