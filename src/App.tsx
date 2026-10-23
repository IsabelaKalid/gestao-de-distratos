import React, { useState } from 'react';
import { DistratoProvider, useDistratos } from './context/DistratoContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { NovoDistratoModal } from './components/NovoDistratoModal';
import { RelatorioImpressaoModal } from './components/RelatorioImpressaoModal';
import { DashboardView } from './views/DashboardView';
import { ListaDistratosView } from './views/ListaDistratosView';
import { DetalheDistratoView } from './views/DetalheDistratoView';
import { TarefasView } from './views/TarefasView';
import { AdminView } from './views/AdminView';
import { Distrato } from './types';

function AppContent() {
  const { distratos, distratoSelecionadoId, selecionarDistrato } = useDistratos();

  // Abas de navegação principais
  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'lista' | 'tarefas' | 'admin'>('dashboard');

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
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col font-sans">
      {/* Header Corporativo */}
      <Header
        onOpenLogin={() => setAbaAtiva('admin')}
        onOpenNovoDistrato={() => setModalNovoDistratoAberto(true)}
        onToggleSidebarMobile={() => setSidebarMobileAberto((prev) => !prev)}
      />

      {/* Layout com Sidebar e Área Principal de Conteúdo */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto items-start">
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

export default function App() {
  return (
    <DistratoProvider>
      <AppContent />
    </DistratoProvider>
  );
}
