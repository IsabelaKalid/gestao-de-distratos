import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Printer,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Landmark,
  Shield,
  ShieldAlert,
  Truck,
  Plus,
  Trash2,
  Calendar,
  Save,
  RotateCcw,
  Check,
  X,
  Upload,
  ExternalLink,
  History,
  FileCheck,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useDistratos } from '../context/DistratoContext';
import {
  formatarMoeda,
  formatarData,
  formatarDataHora,
  calcularDividaTotal,
  calcularTotalPago,
  calcularSaldoRestante,
} from '../utils/calculations';
import { StatusBadge } from '../components/StatusBadge';
import { supabase } from '../lib/supabase';
import { Verificacao, StatusVerificacao, Pagamento } from '../types';

interface DetalheDistratoViewProps {
  distratoId: string;
  onVoltar: () => void;
  onOpenImprimir: () => void;
}

export const DetalheDistratoView: React.FC<DetalheDistratoViewProps> = ({
  distratoId,
  onVoltar,
  onOpenImprimir,
}) => {
  const {
    distratos,
    usuarioAtual,
    atualizarVerificacao,
    adicionarPagamento,
    cancelarPagamento,
    emitirBoleto,
    emitirDistratoTermo,
    conferirDocumentosProtesto,
    encaminharParaProtesto,
    efetivarProtesto,
    encaminharParaAjuizamento,
    adicionarDocumento,
    reabrirDistrato,
  } = useDistratos();

  const distrato = distratos.find((d) => d.id === distratoId);

  // Aba selecionada dentro do processo
  const [abaInterna, setAbaInterna] = useState<
    'auditorias' | 'financeiro' | 'juridico' | 'documentos' | 'historico'
  >('auditorias');
  const arquivoInput = useRef<HTMLInputElement>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [mensagemArquivo, setMensagemArquivo] = useState<string | null>(null);

  const anexarArquivo = async (arquivo?: File) => {
    if (!arquivo || !distrato) return;
    setMensagemArquivo(null);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(arquivo.type) || arquivo.size > 10 * 1024 * 1024) {
      setMensagemArquivo('Escolha um PDF, JPG ou PNG de até 10 MB.');
      return;
    }
    setEnviandoArquivo(true);
    try {
      const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
      const caminho = `${distrato.id}/${crypto.randomUUID()}-${nomeSeguro}`;
      const { error } = await supabase.storage.from('documentos-distratos').upload(caminho, arquivo, {
        contentType: arquivo.type,
        upsert: false,
      });
      if (error) throw error;
      adicionarDocumento(distrato.id, {
        nome: arquivo.name, tipo: arquivo.type, tamanhoKb: Math.ceil(arquivo.size / 1024),
        categoria: 'Documento Geral', url: caminho,
      });
      setMensagemArquivo('Arquivo enviado. Aguarde a confirmação de gravação do distrato na faixa superior.');
    } catch (error) {
      setMensagemArquivo(`Não foi possível enviar o arquivo: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    } finally {
      setEnviandoArquivo(false);
      if (arquivoInput.current) arquivoInput.current.value = '';
    }
  };

  const baixarArquivo = async (nome: string, caminho?: string) => {
    if (!caminho) {
      setMensagemArquivo('Este registro antigo contém apenas o nome do arquivo. Nenhum documento foi enviado.');
      return;
    }
    setMensagemArquivo(null);
    const { data, error } = await supabase.storage.from('documentos-distratos').download(caminho);
    if (error || !data) {
      setMensagemArquivo(`Não foi possível baixar o arquivo: ${error?.message || 'arquivo indisponível'}`);
      return;
    }
    const endereco = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = endereco;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
  };

  // Estado para edição rápida de verificação
  const [editandoVerifId, setEditandoVerifId] = useState<string | null>(null);
  const [formVerif, setFormVerif] = useState<Partial<Verificacao>>({});

  // Estado para novo pagamento
  const [modalNovoPagamento, setModalNovoPagamento] = useState(false);
  const [formPagamento, setFormPagamento] = useState({
    valor: '',
    data: new Date().toISOString().slice(0, 10),
    formaPagamento: 'PIX' as Pagamento['formaPagamento'],
    observacao: '',
    comprovanteNome: '',
  });

  // Estado para emitir boleto
  const [modalEmitirBoleto, setModalEmitirBoleto] = useState(false);
  const [dataVencimentoBoleto, setDataVencimentoBoleto] = useState(
    new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

  // Estado para protesto
  const [modalProtesto, setModalProtesto] = useState(false);
  const [formProtesto, setFormProtesto] = useState({
    cartorio: '',
    custas: '',
    dataEnvio: '',
    comprovanteId: '',
  });
  const [modalEfetivacaoProtesto, setModalEfetivacaoProtesto] = useState(false);
  const [formEfetivacaoProtesto, setFormEfetivacaoProtesto] = useState({ data: '', comprovanteId: '' });

  // Estado para ajuizamento
  const [modalAjuizamento, setModalAjuizamento] = useState(false);
  const [formAjuizamento, setFormAjuizamento] = useState({
    numeroProcesso: '',
    varaComarca: '',
    valorAcao: '',
    observacoes: '',
    comprovanteId: '',
  });

  // Estado para reabertura de processo
  const [modalReabertura, setModalReabertura] = useState(false);
  const [justificativaReabertura, setJustificativaReabertura] = useState('');

  if (!distrato) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-stone-200">
        <p className="text-stone-600 font-semibold">Processo de distrato não encontrado.</p>
        <button
          type="button"
          onClick={onVoltar}
          className="mt-4 px-4 py-2 bg-stone-800 text-white rounded-lg text-xs font-semibold"
        >
          Voltar para Lista
        </button>
      </div>
    );
  }

  const dividaTotal = calcularDividaTotal(distrato);
  const totalPago = calcularTotalPago(distrato);
  const saldoRestante = calcularSaldoRestante(distrato);
  const temPerfilJuridico = ['admin', 'juridico'].includes(usuarioAtual.perfil);
  const podeRegistrarJuridico = temPerfilJuridico && saldoRestante > 0;
  const comprovantesDisponiveis = distrato.documentos.filter((doc) => Boolean(doc.url));

  // Manipuladores de Verificação
  const handleIniciarEdicaoVerif = (v: Verificacao) => {
    setEditandoVerifId(v.id);
    setFormVerif({
      status: v.status,
      valor: v.valor,
      cameraValor: v.cameraValor || 0,
      rastreadorValor: v.rastreadorValor || 0,
      observacoes: v.observacoes || '',
      responsavelAuditoria: usuarioAtual.nome,
    });
  };

  const handleSalvarEdicaoVerif = (verificacaoId: string) => {
    atualizarVerificacao(distrato.id, verificacaoId, {
      ...formVerif,
      dataAuditoria: new Date().toISOString(),
    });
    setEditandoVerifId(null);
    setFormVerif({});
  };

  // Manipulador de Pagamento
  const handleSalvarPagamento = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(formPagamento.valor.replace(/\./g, '').replace(',', '.')) || 0;
    if (val <= 0) return;

    adicionarPagamento(distrato.id, {
      valor: val,
      data: formPagamento.data,
      formaPagamento: formPagamento.formaPagamento,
      observacao: formPagamento.observacao,
      comprovanteNome: formPagamento.comprovanteNome || 'comprovante_bancario.pdf',
    });

    setModalNovoPagamento(false);
    setFormPagamento({
      valor: '',
      data: new Date().toISOString().slice(0, 10),
      formaPagamento: 'PIX',
      observacao: '',
      comprovanteNome: '',
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Botão Superior Voltar e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          id="btn-voltar-detalhe"
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Distratos</span>
        </button>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 w-full sm:w-auto">
          {distrato.statusGeral === 'Quitado' && (
            <button
              id="btn-reabrir-processo"
              type="button"
              onClick={() => setModalReabertura(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>Reabrir Processo</span>
            </button>
          )}

          <button
            id="btn-imprimir-relatorio-termo"
            type="button"
            onClick={onOpenImprimir}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#7e1d2c] hover:bg-[#681623] active:bg-[#54101a] border border-[#c59b4c]/40 text-stone-100 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#dfc28d]" />
            <span>Imprimir Termo & Relatório</span>
          </button>
        </div>
      </div>

      {/* Cartão de Identificação do Processo & Resumo Executivo */}
      <div className="card-gradient-hover detail-hero-card bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 sm:px-6 py-5 bg-gradient-to-r from-[#26070a] via-[#33090f] to-[#1c0406] text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#a87f3b]/30">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="font-mono text-xs font-black px-2.5 py-1 rounded bg-[#3d0f16] border border-[#c59b4c]/40 text-[#dfc28d]">
                {distrato.id}
              </span>
              <span className="text-xs text-stone-300 font-medium">
                Aberto em {formatarData(distrato.dataSolicitacao)}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-100 mt-1">
              {distrato.agregadoNome}
            </h1>
            <p className="text-xs text-stone-300">
              Código: <strong className="font-mono text-stone-200">{distrato.agregadoCodigo}</strong> • Operação: {distrato.gridOperacao} ({distrato.segmento})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-stone-400">Status Geral</div>
              <div className="mt-0.5">
                <StatusBadge status={distrato.statusGeral} size="md" />
              </div>
            </div>
            <div className="text-right pl-3 border-l border-white/10">
              <div className="text-[10px] uppercase font-bold text-stone-400">Financeiro</div>
              <div className="mt-0.5">
                <StatusBadge status={distrato.statusFinanceiro} size="md" />
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Informações do Veículo e Responsabilidade */}
        <div className="px-4 sm:px-6 py-3 bg-[#fcfbf9] border-b border-stone-200 grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-stone-400 block text-[11px]">Tipo de Veículo</span>
            <span className="font-bold text-stone-800">{distrato.tipoDistrato}</span>
          </div>
          <div>
            <span className="text-stone-400 block text-[11px]">Placa(s)</span>
            <span className="font-mono font-bold text-stone-900">
              {distrato.placaCavalo} {distrato.placaCarreta ? `/ ${distrato.placaCarreta}` : ''}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block text-[11px]">Termo de Agregação</span>
            <span className="font-semibold text-stone-800">{distrato.statusTermoAgregacao}</span>
          </div>
          <div>
            <span className="text-stone-400 block text-[11px]">Responsável Atual</span>
            <span className="font-semibold text-stone-800">{distrato.responsavelAtualNome}</span>
          </div>
        </div>

        {/* Resumo Financeiro Consolidado */}
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
          <div className="sm:pr-4">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
              Dívida Total Levantada
            </span>
            <span className="text-2xl font-black text-stone-900 font-mono mt-1 block">
              {formatarMoeda(dividaTotal)}
            </span>
            <span className="text-[11px] text-stone-400 mt-1 block">
              Aluguel: {formatarMoeda(distrato.debitoAluguel)} + Auditorias de Pátio
            </span>
          </div>

          <div className="sm:px-4 pt-3 sm:pt-0">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
              Total Quitado / Pago
            </span>
            <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
              {formatarMoeda(totalPago)}
            </span>
            <span className="text-[11px] text-emerald-700 mt-1 block">
              {distrato.pagamentos.length} lançamento(s) de crédito registrado(s)
            </span>
          </div>

          <div className="sm:pl-4 pt-3 sm:pt-0">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
              Saldo Devedor Remanescente
            </span>
            <span
              className={`text-2xl font-black font-mono mt-1 block ${
                saldoRestante === 0
                  ? 'text-emerald-700'
                  : distrato.statusFinanceiro === 'Vencido'
                  ? 'text-[#8e192a]'
                  : 'text-stone-900'
              }`}
            >
              {formatarMoeda(saldoRestante)}
            </span>
            <span className="text-[11px] text-stone-500 mt-1 block">
              {saldoRestante === 0
                ? 'Processo 100% liquidado'
                : 'Aguardando quitação pelo transportador'}
            </span>
          </div>
        </div>
      </div>

      {/* Navegação entre as Abas Internas do Processo */}
      <div className="border-b border-stone-200 bg-white rounded-xl p-1.5 shadow-2xs flex flex-wrap gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setAbaInterna('auditorias')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
            abaInterna === 'auditorias'
              ? 'bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Truck className="w-4 h-4 text-[#dfc28d]" />
          <span>11 Verificações e Auditorias ({distrato.verificacoes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('financeiro')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
            abaInterna === 'financeiro'
              ? 'bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <DollarSign className="w-4 h-4 text-[#dfc28d]" />
          <span>Cobrança, Boletos & Pagamentos</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('juridico')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
            abaInterna === 'juridico'
              ? 'bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Landmark className="w-4 h-4 text-[#dfc28d]" />
          <span>Cobrança Jurídica (Protesto & Execução)</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('documentos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
            abaInterna === 'documentos'
              ? 'bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <FileText className="w-4 h-4 text-[#dfc28d]" />
          <span>Documentos & Comprovantes ({distrato.documentos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna('historico')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
            abaInterna === 'historico'
              ? 'bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <History className="w-4 h-4 text-[#dfc28d]" />
          <span>Trilha de Auditoria ({distrato.historico.length})</span>
        </button>
      </div>

      {/* ABA 1: AS 11 VERIFICAÇÕES OBRIGATÓRIAS */}
      {abaInterna === 'auditorias' && (
        <div className="space-y-4">
          <div className="detail-info-card bg-[#fbf9f5] p-4 rounded-xl border border-stone-200 text-xs text-stone-700 flex items-start gap-3">
            <Info className="w-5 h-5 text-[#865d1d] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-stone-900">
                Auditoria Multisetorial de Pendências
              </p>
              <p className="mt-0.5 text-stone-600">
                Cada área responsável deve conferir seu respectivo item e cadastrar se há pendência financeira, custos de manutenção, avarias ou se o item está regularizado. Os valores somam automaticamente no saldo do distrato.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Item fixo de Débito de Aluguel */}
            <div className="card-gradient-hover verification-card bg-white p-4 rounded-xl border border-stone-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 text-sm">
                    Débito Inicial de Aluguel de Equipamento / Carreta
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                    Contratual
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Valor apurado no momento do pedido de encerramento pelo setor de Cadastro e Frotas.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-stone-400 block font-medium">Valor Contratual</span>
                <span className="text-base font-bold font-mono text-stone-900">
                  {formatarMoeda(distrato.debitoAluguel)}
                </span>
              </div>
            </div>

            {/* As 11 Verificações */}
            {distrato.verificacoes.map((v, index) => {
              const estaEditando = editandoVerifId === v.id;
              const valorItem =
                v.tipo === 'camera_rastreador'
                  ? (v.cameraValor || 0) + (v.rastreadorValor || 0)
                  : v.valor;

              return (
                <div
                  key={v.id}
                  id={`card-verificacao-${v.id}`}
                  className={`card-gradient-hover verification-card bg-white rounded-xl border transition p-4 ${
                    estaEditando
                      ? 'border-[#7e1d2c] ring-2 ring-[#7e1d2c]/10 shadow-md'
                      : 'border-stone-200/90 shadow-2xs hover:border-stone-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#fbf6ee] border border-[#f0e3ce] text-[#865d1d] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900 text-sm">{v.titulo}</h3>
                          <span className="text-[11px] text-stone-400">
                            • Área: <strong className="text-stone-700">{v.areaResponsavel}</strong>
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">{v.descricao}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <StatusBadge status={v.status} size="sm" />
                        <div className="text-xs font-mono font-bold text-stone-800 mt-1">
                          {formatarMoeda(valorItem)}
                        </div>
                      </div>

                      {!estaEditando && (
                        <button
                          type="button"
                          onClick={() => handleIniciarEdicaoVerif(v)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition cursor-pointer"
                        >
                          Auditar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detalhes / Observações quando não está editando */}
                  {!estaEditando && (
                    <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-stone-500">
                      <div>
                        {v.observacoes ? (
                          <span>
                            <strong>Parecer:</strong> {v.observacoes}
                          </span>
                        ) : (
                          <span className="italic text-stone-400">Nenhuma ressalva anotada.</span>
                        )}
                      </div>
                      <div className="shrink-0 text-stone-400">
                        {v.responsavelAuditoria && (
                          <span>Auditor: {v.responsavelAuditoria} • </span>
                        )}
                        Conferido em: {formatarDataHora(v.dataAuditoria)}
                      </div>
                    </div>
                  )}

                  {/* Painel de Edição da Verificação */}
                  {estaEditando && (
                    <div className="mt-4 pt-4 border-t border-stone-200 bg-[#faf8f5] -mx-4 -mb-4 p-4 rounded-b-xl space-y-3">
                      <div className="text-xs font-bold text-[#7e1d2c] uppercase tracking-wider">
                        Atualizar Auditoria do Item • {usuarioAtual.nome} ({usuarioAtual.perfil === 'admin' ? 'supervisor' : usuarioAtual.perfil})
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Status da Verificação */}
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">
                            Resultado da Análise
                          </label>
                          <select
                            value={formVerif.status}
                            onChange={(e) =>
                              setFormVerif((prev) => ({
                                ...prev,
                                status: e.target.value as StatusVerificacao,
                              }))
                            }
                            className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                          >
                            <option value="Aguardando análise">Aguardando análise</option>
                            <option value="Em análise">Em análise</option>
                            <option value="Aprovado sem pendências">Aprovado sem pendências</option>
                            <option value="Pendência encontrada">Pendência encontrada (Com Débito)</option>
                            <option value="Não aplicável">Não aplicável</option>
                          </select>
                        </div>

                        {/* Valor apurado (ou campos separados se for camera_rastreador) */}
                        {v.tipo === 'camera_rastreador' ? (
                          <>
                            <div>
                              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                                Custo Câmera de Cabine (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={formVerif.cameraValor || 0}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    cameraValor: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                                Custo Rastreador / Antena (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={formVerif.rastreadorValor || 0}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    rastreadorValor: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                              />
                            </div>
                          </>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-bold text-stone-700 mb-1">
                              Valor do Débito / Avaria (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={formVerif.valor || 0}
                              onChange={(e) =>
                                setFormVerif((prev) => ({
                                  ...prev,
                                  valor: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                            />
                          </div>
                        )}
                      </div>

                      {/* Observações da Auditoria */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Parecer Técnico / Observações da Auditoria
                        </label>
                        <input
                          type="text"
                          value={formVerif.observacoes || ''}
                          onChange={(e) =>
                            setFormVerif((prev) => ({ ...prev, observacoes: e.target.value }))
                          }
                          placeholder="Descreva detalhes de notas fiscais, fotos de avaria, laudo mecânico ou motivo de isenção..."
                          className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                        />
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditandoVerifId(null)}
                          className="px-3 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200 rounded-lg transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSalvarEdicaoVerif(v.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] rounded-lg shadow-2xs transition cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5 text-[#dfc28d]" />
                          <span>Salvar Auditoria</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 2: FINANCEIRO, BOLETOS E PAGAMENTOS */}
      {abaInterna === 'financeiro' && (
        <div className="space-y-6">
          {/* Ações Rápidas de Cobrança */}
          <div className="card-gradient-hover flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Gestão de Pagamentos & Boletos</h3>
              <p className="text-xs text-stone-500">
                Emissão de boletos bancários para quitação das pendências e baixa manual/automatizada.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalEmitirBoleto(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-stone-600" />
                <span>Emitir Novo Boleto</span>
              </button>

              <button
                type="button"
                onClick={() => setModalNovoPagamento(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Pagamento</span>
              </button>
            </div>
          </div>

          {/* Lista de Boletos Gerados */}
          <div className="card-gradient-hover bg-white rounded-xl border border-stone-200/80 shadow-2xs p-5">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-3">
              Boletos Bancários Vinculados ao Distrato
            </h4>
            {distrato.boletos.length === 0 ? (
              <p className="text-xs text-stone-400 py-4 text-center">
                Nenhum boleto foi emitido ainda para este processo.
              </p>
            ) : (
              <div className="space-y-2">
                {distrato.boletos.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                          {b.numero}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.status === 'Pago'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'Vencido'
                              ? 'bg-rose-100 text-[#8e192a]'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-stone-500 truncate max-w-lg">
                        Linha digitável: {b.linhaDigitavel}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-sm text-stone-900">
                        {formatarMoeda(b.valor)}
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Vencimento: {formatarData(b.dataVencimento)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico de Pagamentos Realizados */}
          <div className="card-gradient-hover bg-white rounded-xl border border-stone-200/80 shadow-2xs p-5">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-3">
              Créditos & Baixas Realizadas
            </h4>
            {distrato.pagamentos.length === 0 ? (
              <p className="text-xs text-stone-400 py-4 text-center">
                Nenhum pagamento registrado até o momento.
              </p>
            ) : (
              <div className="space-y-2">
                {distrato.pagamentos.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900">
                            {formatarMoeda(p.valor)}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                            Forma: {p.formaPagamento}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Registrado em {formatarData(p.data)} por {p.registradoPorNome}
                          {p.observacao && ` • Obs: ${p.observacao}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {p.comprovanteNome && (
                        <span className="text-[11px] text-stone-500 font-mono">
                          📎 {p.comprovanteNome}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const just = prompt('Informe a justificativa do estorno/cancelamento deste pagamento:');
                          if (just) cancelarPagamento(distrato.id, p.id, just);
                        }}
                        className="p-1 rounded text-stone-400 hover:text-[#8e192a] hover:bg-white"
                        title="Cancelar / Estornar pagamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: JURÍDICO, PROTESTO E AJUIZAMENTO */}
      {abaInterna === 'juridico' && (
        <div className="space-y-6">
          {/* Card de Informações e Fluxo */}
          <div className="bg-[#fbf9f5] p-5 rounded-2xl border border-stone-200 space-y-2 text-xs text-stone-700">
            <h3 className="text-sm font-bold text-[#7e1d2c] flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#7e1d2c]" />
              <span>Fluxo Extrajudicial & Execução Judicial de Títulos</span>
            </h3>
            <p className="leading-relaxed text-stone-600">
              Caso o agregado não efetue a quitação amigável das pendências contratuais dentro do prazo do boleto bancário, o título é conferido documentalmente pelo setor de Cobrança e encaminhado para <strong>Protesto em Cartório</strong> ou <strong>Ajuizamento de Ação de Execução</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bloco 1: Protesto em Cartório */}
            <div className="card-gradient-hover bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#8e192a]" />
                  <h4 className="font-bold text-stone-900 text-sm">Protesto Extrajudicial</h4>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    distrato.encaminhadoProtesto
                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {distrato.encaminhadoProtesto ? 'Encaminhado' : 'Não encaminhado'}
                </span>
              </div>

              {distrato.encaminhadoProtesto ? (
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-1">
                    <p className="font-bold text-purple-950">Cartório de Registro:</p>
                    <p className="text-purple-900">{distrato.cartorioProtesto || 'Cartório não informado'}</p>
                    <p className="text-purple-800 text-[11px] mt-1">
                      Data de envio: {distrato.dataEnvioProtesto ? formatarData(distrato.dataEnvioProtesto) : 'N/A'} • Custas: {formatarMoeda(distrato.custasCartorio || 0)}
                    </p>
                    {distrato.comprovanteProtestoId && <p className="text-purple-800 text-[11px]">Comprovante vinculado: {distrato.documentos.find((doc) => doc.id === distrato.comprovanteProtestoId)?.nome || 'Documento não encontrado'}</p>}
                  </div>

                  {!distrato.dataEfetivacaoProtesto ? (
                    <button
                      type="button"
                      disabled={!temPerfilJuridico}
                      onClick={() => setModalEfetivacaoProtesto(true)}
                      className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Registrar Efetivação do Protesto no Cartório
                    </button>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold text-center">
                      ✓ Protesto Efetivado em {formatarData(distrato.dataEfetivacaoProtesto)}
                      {distrato.comprovanteEfetivacaoProtestoId && <span className="block mt-1">Comprovante: {distrato.documentos.find((doc) => doc.id === distrato.comprovanteEfetivacaoProtestoId)?.nome || 'Documento não encontrado'}</span>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-stone-500">
                    Registre aqui apenas um encaminhamento realmente realizado fora do sistema, após conferência pelo jurídico.
                  </p>
                  <button
                    type="button"
                    disabled={!podeRegistrarJuridico}
                    onClick={() => setModalProtesto(true)}
                    className="w-full py-2 bg-[#7e1d2c] hover:bg-[#681623] text-stone-100 border border-[#c59b4c]/30 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Registrar encaminhamento a protesto
                  </button>
                </div>
              )}
            </div>

            {/* Bloco 2: Ajuizamento Judicial */}
            <div className="card-gradient-hover bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-rose-700" />
                  <h4 className="font-bold text-stone-900 text-sm">Ação Judicial de Execução</h4>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    distrato.encaminhadoAjuizamento
                      ? 'bg-rose-100 text-rose-900 border border-rose-300'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {distrato.encaminhadoAjuizamento ? 'Ajuizado' : 'Não ajuizado'}
                </span>
              </div>

              {distrato.encaminhadoAjuizamento ? (
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 space-y-1">
                    <p className="font-bold text-rose-950 font-mono">
                      Processo: {distrato.numeroProcessoJudicial}
                    </p>
                    <p className="text-rose-900">{distrato.varaComarca || 'Vara e comarca não informadas'}</p>
                    <p className="text-rose-800 text-[11px] mt-1">
                      Data da Distribuição: {distrato.dataAjuizamento ? formatarData(distrato.dataAjuizamento) : 'N/A'} • Valor da Causa: {formatarMoeda(distrato.valorAcaoJudicial || saldoRestante)}
                    </p>
                    {distrato.comprovanteAjuizamentoId && <p className="text-rose-800 text-[11px]">Comprovante vinculado: {distrato.documentos.find((doc) => doc.id === distrato.comprovanteAjuizamentoId)?.nome || 'Documento não encontrado'}</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-stone-500">
                    Registre aqui apenas um ajuizamento já realizado pelo jurídico fora deste sistema.
                  </p>
                  <button
                    type="button"
                    disabled={!podeRegistrarJuridico}
                    onClick={() => {
                      setFormAjuizamento((prev) => ({
                        ...prev,
                        valorAcao: saldoRestante.toFixed(2),
                      }));
                      setModalAjuizamento(true);
                    }}
                    className="w-full py-2 bg-[#8e192a] hover:bg-[#721220] text-white rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Registrar ajuizamento realizado
                  </button>
                </div>
              )}
            </div>
          </div>
          {!podeRegistrarJuridico && <p className="text-sm text-amber-900">{saldoRestante <= 0 ? 'Registro indisponível: este distrato não possui saldo em aberto.' : 'Registro indisponível: exige perfil jurídico ou supervisor.'}</p>}
        </div>
      )}

      {/* ABA 4: DOCUMENTOS & ANEXOS */}
      {abaInterna === 'documentos' && (
        <div className="space-y-4">
          <div className="card-gradient-hover flex items-center justify-between bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Repositório de Documentos</h3>
              <p className="text-xs text-stone-500">
                Termos assinados, laudos fotográficos de pátio, certidões ANTT e comprovantes de pagamento.
              </p>
            </div>
            <input
              ref={arquivoInput}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              aria-label="Escolher documento para anexar"
              onChange={(event) => void anexarArquivo(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={enviandoArquivo}
              onClick={() => arquivoInput.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-stone-100 bg-[#7e1d2c] hover:bg-[#681623] rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#dfc28d]" />
              <span>{enviandoArquivo ? 'Enviando…' : 'Anexar Arquivo'}</span>
            </button>
          </div>

          {mensagemArquivo && <p role="status" className="text-sm text-[#7e1d2c]">{mensagemArquivo}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {distrato.documentos.map((doc) => (
              <div
                key={doc.id}
                className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/90 shadow-2xs flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-[#fbf6ee] text-[#865d1d] shrink-0 mt-0.5 border border-[#f0e3ce]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-stone-900 truncate">{doc.nome}</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {doc.categoria || 'Documento Geral'} • {doc.tamanhoKb} KB
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      Enviado por {doc.enviadoPorNome} em {formatarData(doc.dataUpload)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void baixarArquivo(doc.nome, doc.url)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                  title="Baixar arquivo"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 5: TRILHA DE AUDITORIA / HISTÓRICO */}
      {abaInterna === 'historico' && (
        <div className="card-gradient-hover bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-6 space-y-4">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Trilha de Auditoria Imutável</h3>
            <p className="text-xs text-stone-500">
              Registro cronológico de todas as modificações, pareceres e lançamentos com carimbo de usuário.
            </p>
          </div>

          <div className="relative border-l-2 border-stone-200 ml-4 space-y-6 pt-2">
            {distrato.historico.map((h) => (
              <div key={h.id} className="relative pl-6 text-xs">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#7e1d2c] border-2 border-white ring-2 ring-stone-200" />
                <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                  <span>{formatarDataHora(h.dataHora)}</span>
                  <span>•</span>
                  <span className="font-semibold text-stone-700">{h.usuarioNome}</span>
                  <span>({h.usuarioPerfil})</span>
                </div>
                <p className="font-bold text-stone-900 mt-0.5">
                  Alteração em "{h.campoAlterado}":
                </p>
                <div className="mt-1 p-2 rounded-lg bg-stone-50 border border-stone-100 text-stone-600 text-[11px] font-mono">
                  De: <span className="text-stone-400">{h.valorAnterior || 'Vazio'}</span> → Para:{' '}
                  <span className="text-stone-900 font-bold">{h.valorNovo}</span>
                </div>
                {h.justificativa && (
                  <p className="text-[11px] text-stone-500 italic mt-1">
                    Justificativa: {h.justificativa}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: NOVO PAGAMENTO */}
      {modalNovoPagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#26070a] border-b border-[#a87f3b]/30 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-100">Registrar Pagamento / Quitação</h3>
              <button
                type="button"
                onClick={() => setModalNovoPagamento(false)}
                className="p-1 rounded text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarPagamento} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Valor Pago (R$) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={formPagamento.valor}
                  onChange={(e) => {
                    let clean = e.target.value.replace(/[^\d]/g, '');
                    if (!clean) clean = '0';
                    const num = parseFloat(clean) / 100;
                    setFormPagamento((prev) => ({
                      ...prev,
                      valor: num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                    }));
                  }}
                  className="w-full px-3 py-2 text-sm font-bold font-mono border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 outline-none"
                  autoFocus
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Saldo devedor atual: {formatarMoeda(saldoRestante)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Data do Pagamento
                  </label>
                  <input
                    type="date"
                    required
                    value={formPagamento.data}
                    onChange={(e) =>
                      setFormPagamento((prev) => ({ ...prev, data: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={formPagamento.formaPagamento}
                    onChange={(e) =>
                      setFormPagamento((prev) => ({
                        ...prev,
                        formaPagamento: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white outline-none"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="TED">Transferência TED</option>
                    <option value="Compensação em Frete">Compensação em Frete</option>
                    <option value="Depósito Identificado">Depósito Identificado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Observações / Detalhes da Baixa
                </label>
                <input
                  type="text"
                  placeholder="Ex: Quitação parcela 1/2 conforme acordo comercial"
                  value={formPagamento.observacao}
                  onChange={(e) =>
                    setFormPagamento((prev) => ({ ...prev, observacao: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoPagamento(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMITIR BOLETO */}
      {modalEmitirBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#26070a] border-b border-[#a87f3b]/30 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-100">Emitir Boleto Bancário de Distrato</h3>
              <button
                type="button"
                onClick={() => setModalEmitirBoleto(false)}
                className="p-1 rounded text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-500 block">Sacado (Agregado):</span>
                <span className="font-bold text-stone-900 block text-sm">{distrato.agregadoNome}</span>
                <span className="text-stone-500 font-mono">{distrato.agregadoCodigo}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Data de Vencimento do Boleto
                </label>
                <input
                  type="date"
                  value={dataVencimentoBoleto}
                  onChange={(e) => setDataVencimentoBoleto(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white outline-none"
                />
              </div>

              <div>
                <span className="text-stone-500 block text-[11px]">Valor Total do Boleto:</span>
                <span className="font-mono font-bold text-lg text-stone-900 block">
                  {formatarMoeda(saldoRestante)}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalEmitirBoleto(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    emitirBoleto(distrato.id, dataVencimentoBoleto, saldoRestante);
                    setModalEmitirBoleto(false);
                  }}
                  className="px-4 py-2 font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] rounded-lg shadow-2xs cursor-pointer"
                >
                  Gerar e Registrar Boleto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EFETIVAÇÃO DO PROTESTO */}
      {modalEfetivacaoProtesto && temPerfilJuridico && distrato.encaminhadoProtesto && !distrato.dataEfetivacaoProtesto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#26070a] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Registrar efetivação comprovada do protesto</h3>
              <button type="button" onClick={() => setModalEfetivacaoProtesto(false)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-stone-600">Registre somente após receber a confirmação do cartório. Anexe o comprovante primeiro na aba Documentos & Comprovantes.</p>
              <div>
                <label className="block font-bold text-stone-700 mb-1">Data da efetivação</label>
                <input type="date" value={formEfetivacaoProtesto.data} onChange={(e) => setFormEfetivacaoProtesto((prev) => ({ ...prev, data: e.target.value }))} className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">Comprovante da efetivação já anexado</label>
                <select value={formEfetivacaoProtesto.comprovanteId} onChange={(e) => setFormEfetivacaoProtesto((prev) => ({ ...prev, comprovanteId: e.target.value }))} className="w-full px-3 py-2 border border-stone-300 rounded-lg">
                  <option value="">Selecione um arquivo anexado</option>
                  {comprovantesDisponiveis.map((doc) => <option key={doc.id} value={doc.id}>{doc.nome}</option>)}
                </select>
                {comprovantesDisponiveis.length === 0 && <p className="mt-1 text-amber-900">Nenhum arquivo anexado de verdade a este distrato.</p>}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalEfetivacaoProtesto(false)} className="px-4 py-2 font-semibold text-stone-600">Cancelar</button>
                <button type="button" onClick={() => {
                  if (!formEfetivacaoProtesto.data || !comprovantesDisponiveis.some((doc) => doc.id === formEfetivacaoProtesto.comprovanteId)) {
                    window.alert('Informe a data e selecione o comprovante real da efetivação.');
                    return;
                  }
                  efetivarProtesto(distrato.id, formEfetivacaoProtesto.data, formEfetivacaoProtesto.comprovanteId);
                  setModalEfetivacaoProtesto(false);
                }} className="px-4 py-2 font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg">Confirmar registro interno</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROTESTO */}
      {modalProtesto && podeRegistrarJuridico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#26070a] border-b border-[#a87f3b]/30 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-100">Registrar protesto realizado fora do sistema</h3>
              <button
                type="button"
                onClick={() => setModalProtesto(false)}
                className="p-1 rounded text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Cartório / Tabelionato de Protesto
                </label>
                <input
                  type="text"
                  value={formProtesto.cartorio}
                  onChange={(e) => setFormProtesto((prev) => ({ ...prev, cartorio: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Custas Cartorárias (R$)
                  </label>
                  <input
                    type="text"
                    value={formProtesto.custas}
                    onChange={(e) => setFormProtesto((prev) => ({ ...prev, custas: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Data do Envio
                  </label>
                  <input
                    type="date"
                    value={formProtesto.dataEnvio}
                    onChange={(e) => setFormProtesto((prev) => ({ ...prev, dataEnvio: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Comprovante do encaminhamento já anexado</label>
                <select value={formProtesto.comprovanteId} onChange={(e) => setFormProtesto((prev) => ({ ...prev, comprovanteId: e.target.value }))} className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg">
                  <option value="">Selecione um arquivo anexado</option>
                  {comprovantesDisponiveis.map((doc) => <option key={doc.id} value={doc.id}>{doc.nome}</option>)}
                </select>
                {comprovantesDisponiveis.length === 0 && <p className="mt-1 text-amber-900">Anexe primeiro o comprovante em Documentos & Comprovantes.</p>}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalProtesto(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!formProtesto.cartorio.trim() || !formProtesto.dataEnvio) { window.alert('Informe o cartório e a data reais.'); return; }
                    if (!comprovantesDisponiveis.some((doc) => doc.id === formProtesto.comprovanteId)) { window.alert('Selecione o comprovante real do encaminhamento.'); return; }
                    const custas = parseFloat(formProtesto.custas.replace(',', '.')) || 0;
                    encaminharParaProtesto(distrato.id, formProtesto.cartorio, custas, formProtesto.dataEnvio, formProtesto.comprovanteId);
                    setModalProtesto(false);
                  }}
                  className="px-4 py-2 font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-2xs cursor-pointer"
                >
                  Confirmar registro interno do protesto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AJUIZAMENTO */}
      {modalAjuizamento && podeRegistrarJuridico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#26070a] border-b border-[#a87f3b]/30 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-100">Distribuição de Execução Judicial</h3>
              <button
                type="button"
                onClick={() => setModalAjuizamento(false)}
                className="p-1 rounded text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Número do Processo Judicial
                </label>
                <input
                  type="text"
                  value={formAjuizamento.numeroProcesso}
                  onChange={(e) =>
                    setFormAjuizamento((prev) => ({ ...prev, numeroProcesso: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-stone-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Vara e Comarca
                </label>
                <input
                  type="text"
                  value={formAjuizamento.varaComarca}
                  onChange={(e) =>
                    setFormAjuizamento((prev) => ({ ...prev, varaComarca: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Valor da Execução (R$)
                </label>
                <input
                  type="text"
                  value={formAjuizamento.valorAcao}
                  onChange={(e) =>
                    setFormAjuizamento((prev) => ({ ...prev, valorAcao: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-stone-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Comprovante do ajuizamento já anexado</label>
                <select value={formAjuizamento.comprovanteId} onChange={(e) => setFormAjuizamento((prev) => ({ ...prev, comprovanteId: e.target.value }))} className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg">
                  <option value="">Selecione um arquivo anexado</option>
                  {comprovantesDisponiveis.map((doc) => <option key={doc.id} value={doc.id}>{doc.nome}</option>)}
                </select>
                {comprovantesDisponiveis.length === 0 && <p className="mt-1 text-amber-900">Anexe primeiro o comprovante em Documentos & Comprovantes.</p>}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAjuizamento(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!formAjuizamento.numeroProcesso.trim() || !formAjuizamento.varaComarca.trim()) { window.alert('Informe o número de processo e a vara reais.'); return; }
                    if (!comprovantesDisponiveis.some((doc) => doc.id === formAjuizamento.comprovanteId)) { window.alert('Selecione o comprovante real do ajuizamento.'); return; }
                    const val = parseFloat(formAjuizamento.valorAcao.replace(',', '.')) || saldoRestante;
                    encaminharParaAjuizamento(distrato.id, {
                      numeroProcesso: formAjuizamento.numeroProcesso,
                      varaComarca: formAjuizamento.varaComarca,
                      valorAcao: val,
                      observacoes: formAjuizamento.observacoes,
                      comprovanteId: formAjuizamento.comprovanteId,
                    });
                    setModalAjuizamento(false);
                  }}
                  className="px-4 py-2 font-bold text-white bg-[#8e192a] hover:bg-[#721220] rounded-lg shadow-2xs cursor-pointer"
                >
                  Registrar Ajuizamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REABERTURA DE PROCESSO */}
      {modalReabertura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#26070a] border-b border-[#a87f3b]/30 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-100">Reabrir Processo Quitado</h3>
              <button
                type="button"
                onClick={() => setModalReabertura(false)}
                className="p-1 rounded text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-stone-600 leading-relaxed">
                A reabertura de um distrato concluído requer justificativa obrigatória e ficará registrada permanentemente na trilha de auditoria para fins de compliance.
              </p>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Justificativa Formal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={justificativaReabertura}
                  onChange={(e) => setJustificativaReabertura(e.target.value)}
                  placeholder="Ex: Identificada multa de trânsito tardia referente ao período contratual..."
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalReabertura(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!justificativaReabertura.trim()}
                  onClick={() => {
                    reabrirDistrato(distrato.id, justificativaReabertura);
                    setModalReabertura(false);
                    setJustificativaReabertura('');
                  }}
                  className="px-4 py-2 font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-lg shadow-2xs cursor-pointer"
                >
                  Confirmar Reabertura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
