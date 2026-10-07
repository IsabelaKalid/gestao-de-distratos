import React, { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Truck, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { useDistratos } from '../context/DistratoContext';
import { Distrato } from '../types';
import { supabase } from '../lib/supabase';

const textoParaNumero = (valor: string) => {
  const texto = valor.trim();
  if (!texto) return 0;
  const ultimaVirgula = texto.lastIndexOf(',');
  const ultimoPonto = texto.lastIndexOf('.');
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const decimal = ultimaVirgula > ultimoPonto ? ',' : '.';
    const milhar = decimal === ',' ? /\./g : /,/g;
    return Number(texto.replace(milhar, '').replace(decimal, '.')) || 0;
  }
  if (ultimaVirgula >= 0) return Number(texto.replace(',', '.')) || 0;
  if (ultimoPonto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(texto)) {
    return Number(texto.replace(/\./g, '')) || 0;
  }
  return Number(texto) || 0;
};

interface NovoDistratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (novoId: string) => void;
}

export const NovoDistratoModal: React.FC<NovoDistratoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { criarDistrato, adicionarDocumento } = useDistratos();

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [arquivosIniciais, setArquivosIniciais] = useState<File[]>([]);
  const [categoriaDocumento, setCategoriaDocumento] = useState('Solicitação de encerramento');
  const [descricaoDocumento, setDescricaoDocumento] = useState('');

  // Formulário em etapas
  const [form, setForm] = useState({
    agregadoNome: '',
    empresaNome: '',
    tipoDistrato: 'Cavalo e Carreta' as Distrato['tipoDistrato'],
    placaCavalo: '',
    placaCarreta: '',
    dataEngateInicial: '',
    dataEngateFinal: '',
    gridOperacao: 'Uruguai',
    gridOutro: '',
    segmento: 'Aço',
    segmentoOutro: '',
    debitoAluguel: '',
    statusTermoAgregacao: 'Em Encerramento' as Distrato['statusTermoAgregacao'],
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErroValidacao(null);
  };

  const handleMoedaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mantém o campo livre durante a digitação e aceita vírgula ou ponto.
    const valor = e.target.value
      .replace(/[^\d,.]/g, '')
      .replace(/([,.].*)[,.]/g, '$1');
    setForm((prev) => ({ ...prev, debitoAluguel: valor }));
    setErroValidacao(null);
  };

  const avancarEtapa = () => {
    setErroValidacao(null);
    if (etapa === 1) {
      if (!form.agregadoNome.trim()) {
        setErroValidacao('Informe o nome completo ou razão social do agregado.');
        return;
      }
      setEtapa(2);
    } else if (etapa === 2) {
      if (form.tipoDistrato !== 'Carreta' && !form.placaCavalo.trim()) {
        setErroValidacao('Informe a placa do cavalo mecânico.');
        return;
      }
      if (form.tipoDistrato !== 'Cavalo' && !form.placaCarreta.trim()) {
        setErroValidacao('Informe a placa da carreta / semirreboque.');
        return;
      }
      setEtapa(3);
    }
  };

  const handleArquivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []);
    const invalido = arquivos.find(
      (arquivo) =>
        !['application/pdf', 'image/jpeg', 'image/png'].includes(arquivo.type) ||
        arquivo.size > 10 * 1024 * 1024,
    );
    if (invalido) {
      setErroValidacao('Os documentos devem ser PDF, JPG ou PNG e ter no máximo 10 MB cada.');
      e.target.value = '';
      return;
    }
    setArquivosIniciais(arquivos);
    setErroValidacao(null);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroValidacao(null);
    if (salvando) return;

    // Converte string monetária brasileira para número float seguro
    const valorNumerico = textoParaNumero(form.debitoAluguel);

    let idGerado: string | null = null;
    try {
      setSalvando(true);
      idGerado = criarDistrato({
        agregadoNome: form.agregadoNome,
        empresaNome: form.empresaNome,
        placaCavalo: form.placaCavalo,
        placaCarreta: form.placaCarreta,
        dataEngateInicial: form.dataEngateInicial,
        dataEngateFinal: form.dataEngateFinal,
        tipoDistrato: form.tipoDistrato,
        gridOperacao:
          form.gridOperacao === 'Outro'
            ? form.gridOutro.trim() || 'Outro'
            : form.gridOperacao,
        segmento:
          form.segmento === 'Outro'
            ? form.segmentoOutro.trim() || 'Outro'
            : form.segmento,
        debitoAluguel: valorNumerico,
        statusTermoAgregacao: form.statusTermoAgregacao,
      });

      for (const arquivo of arquivosIniciais) {
        const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
        const caminho = `${idGerado}/cadastro-inicial/${crypto.randomUUID()}-${nomeSeguro}`;
        const { error } = await supabase.storage
          .from('documentos-distratos')
          .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
        if (error) throw error;
        adicionarDocumento(idGerado, {
          nome: arquivo.name,
          tipo: arquivo.type,
          tamanhoKb: Math.ceil(arquivo.size / 1024),
          categoria: categoriaDocumento,
          descricao: descricaoDocumento.trim() || 'Documento anexado na abertura do distrato',
          origem: 'Cadastro inicial',
          url: caminho,
        });
      }

      // Reset
      setEtapa(1);
      setForm({
        agregadoNome: '',
        empresaNome: '',
        tipoDistrato: 'Cavalo e Carreta',
        placaCavalo: '',
        placaCarreta: '',
        dataEngateInicial: '',
        dataEngateFinal: '',
        gridOperacao: 'Uruguai',
        gridOutro: '',
        segmento: 'Aço',
        segmentoOutro: '',
        debitoAluguel: '',
        statusTermoAgregacao: 'Em Encerramento',
      });
      setArquivosIniciais([]);
      setCategoriaDocumento('Solicitação de encerramento');
      setDescricaoDocumento('');

      onSuccess(idGerado);
    } catch (err) {
      if (idGerado) {
        window.alert('O distrato foi criado, mas algum documento não pôde ser enviado. Confira o processo e anexe novamente em Documentos & Comprovantes.');
        onSuccess(idGerado);
      } else {
        setErroValidacao('Não foi possível criar o distrato. Tente novamente.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[94dvh] sm:max-h-[calc(100dvh-2rem)] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#26070a] border-b border-[#a87f3b]/30 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3d0f16] border border-[#c59b4c]/50 flex items-center justify-center text-white">
              <Truck className="w-5 h-5 text-[#dfc28d]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-100">Cadastro de Novo Distrato</h2>
              <p className="hidden sm:block text-xs text-stone-400">
                Início de processo formal de encerramento contratual • Transpanorama
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-[#340b10] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progresso das Etapas */}
        <div className="px-4 sm:px-6 py-3 bg-[#faf8f5] border-b border-stone-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                etapa >= 1 ? 'bg-[#7e1d2c] text-white' : 'bg-stone-200 text-stone-500'
              }`}
            >
              1
            </div>
            <span className={`${etapa === 1 ? 'font-bold text-stone-900' : 'text-stone-500'} hidden min-[430px]:inline`}>
              Agregado
            </span>
          </div>
          <div className="h-0.5 flex-1 mx-4 bg-stone-200" />
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                etapa >= 2 ? 'bg-[#7e1d2c] text-white' : 'bg-stone-200 text-stone-500'
              }`}
            >
              2
            </div>
            <span className={`${etapa === 2 ? 'font-bold text-stone-900' : 'text-stone-500'} hidden min-[430px]:inline`}>
              Veículo & Rota
            </span>
          </div>
          <div className="h-0.5 flex-1 mx-4 bg-stone-200" />
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                etapa === 3 ? 'bg-[#7e1d2c] text-white' : 'bg-stone-200 text-stone-500'
              }`}
            >
              3
            </div>
            <span className={`${etapa === 3 ? 'font-bold text-stone-900' : 'text-stone-500'} hidden min-[430px]:inline`}>
              Financeiro & Aluguel
            </span>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {erroValidacao && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-[#8e192a] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erroValidacao}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSalvar} className="p-4 sm:p-6 overflow-y-auto overscroll-contain">
          {/* ETAPA 1: DADOS DO AGREGADO */}
          {etapa === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nome Completo / Razão Social do Agregado <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="agregadoNome"
                  value={form.agregadoNome}
                  onChange={handleChange}
                  placeholder="Ex: João Ferreira da Silva ou TransSilva Eireli"
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nome da empresa
                </label>
                <input
                  type="text"
                  name="empresaNome"
                  value={form.empresaNome}
                  onChange={handleChange}
                  placeholder="Ex.: Transportadora ou empresa vinculada"
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#d8bd86] bg-[#fbf6ee] px-3.5 py-2">
                  <p className="text-xs font-bold text-stone-700">Código do Agregado</p>
                  <p className="mt-1 text-xs text-[#7e1d2c]">Gerado automaticamente pelo sistema ao salvar.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Status Atual do Termo de Agregação
                  </label>
                  <select
                    name="statusTermoAgregacao"
                    value={form.statusTermoAgregacao}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none bg-white"
                  >
                    <option value="Em Encerramento">Em Encerramento</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-bold text-stone-700">
                  Data do engate inicial
                  <input
                    type="date"
                    name="dataEngateInicial"
                    value={form.dataEngateInicial}
                    onChange={handleChange}
                    className="mt-1 w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                  />
                </label>
                <label className="block text-xs font-bold text-stone-700">
                  Data do engate final
                  <input
                    type="date"
                    name="dataEngateFinal"
                    value={form.dataEngateFinal}
                    min={form.dataEngateInicial || undefined}
                    onChange={handleChange}
                    className="mt-1 w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                  />
                </label>
              </div>
            </div>
          )}

          {/* ETAPA 2: VEÍCULO E OPERAÇÃO */}
          {etapa === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tipo de Distrato <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
                  {(['Cavalo', 'Carreta', 'Cavalo e Carreta'] as const).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, tipoDistrato: tipo }))}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition cursor-pointer ${
                        form.tipoDistrato === tipo
                          ? 'bg-[#fcf3f4] border-[#7e1d2c] text-[#7e1d2c] font-bold'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {form.tipoDistrato !== 'Carreta' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Placa do Cavalo Mecânico <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="placaCavalo"
                      value={form.placaCavalo}
                      onChange={handleChange}
                      placeholder="Ex: ABC1D23"
                      maxLength={8}
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none uppercase font-mono tracking-wider"
                    />
                  </div>
                )}

                {form.tipoDistrato !== 'Cavalo' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Placa da Carreta / Semirreboque <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="placaCarreta"
                      value={form.placaCarreta}
                      onChange={handleChange}
                      placeholder="Ex: XYZ9K88"
                      maxLength={8}
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none uppercase font-mono tracking-wider"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Grid <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="gridOperacao"
                    value={form.gridOperacao}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none bg-white"
                  >
                    <option value="Uruguai">Uruguai</option>
                    <option value="México">México</option>
                    <option value="EUA">EUA</option>
                    <option value="Outro">Outro</option>
                  </select>
                  {form.gridOperacao === 'Outro' && (
                    <input
                      type="text"
                      name="gridOutro"
                      value={form.gridOutro}
                      onChange={handleChange}
                      placeholder="Escreva outro grid (opcional)"
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Segmento <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="segmento"
                    value={form.segmento}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none bg-white"
                  >
                    <option value="Aço">Aço</option>
                    <option value="Vegetal">Vegetal</option>
                    <option value="Graneleiro">Graneleiro</option>
                    <option value="Outro">Outro</option>
                  </select>
                  {form.segmento === 'Outro' && (
                    <input
                      type="text"
                      name="segmentoOutro"
                      value={form.segmentoOutro}
                      onChange={handleChange}
                      placeholder="Escreva outro segmento (opcional)"
                      className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3: FINANCEIRO E DÉBITO INICIAL DE ALUGUEL */}
          {etapa === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Débito de Aluguel de Equipamento / Carreta (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-stone-400">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="debitoAluguel"
                    value={form.debitoAluguel}
                    onChange={handleMoedaChange}
                    placeholder="0,00"
                    className="w-full pl-10 pr-3.5 py-2 text-xs font-bold border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 focus:border-[#7e1d2c] outline-none"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Valor acumulado de aluguel ou diárias contratuais devidas. Insira 0,00 caso não haja pendência de locação.
                </p>
              </div>

              <div className="rounded-xl p-4 bg-[#fbf9f5] border border-[#e8dfd3] space-y-2">
                <div className="text-xs font-bold text-[#7e1d2c] flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#7e1d2c]" />
                  <span>Criação Automática das 12 Verificações</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Ao confirmar, o sistema gerará o ID exclusivo do distrato e atribuirá as 12 verificações do fluxo (Aluguel de Equipamento, Manutenção, Sinistro, Carga, Multas, Abastecimento, Estadia, Câmera/Rastreador, Estacionamento, Pneus, ANTT e Suprimentos) com status "Aguardando análise".
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-stone-800">Documentos da abertura <span className="font-normal text-stone-500">(opcional)</span></h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                    Anexe a solicitação de encerramento, contrato/termo de agregação ou documentos do agregado e do veículo. Eles ficarão em Documentos &amp; Comprovantes.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-stone-700">
                    Tipo de documento
                    <select value={categoriaDocumento} onChange={(e) => setCategoriaDocumento(e.target.value)} className="mt-1 w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg bg-white outline-none focus:border-[#7e1d2c]">
                      <option>Solicitação de encerramento</option>
                      <option>Termo de agregação / contrato</option>
                      <option>Documento do agregado</option>
                      <option>Documento do veículo</option>
                      <option>Termo de encerramento</option>
                      <option>Outro</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-stone-700">
                    Identificação / observação
                    <input type="text" value={descricaoDocumento} onChange={(e) => setDescricaoDocumento(e.target.value)} placeholder="Ex.: contrato assinado em 2025" className="mt-1 w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg outline-none focus:border-[#7e1d2c]" />
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#c59b4c] bg-[#fffaf0] px-4 py-3 text-xs text-stone-700 hover:bg-[#fbf3e4]">
                  <Upload className="h-4 w-4 shrink-0 text-[#7e1d2c]" />
                  <span className="min-w-0 flex-1 truncate">{arquivosIniciais.length ? `${arquivosIniciais.length} arquivo(s) selecionado(s)` : 'Escolher documentos (PDF, JPG ou PNG, até 10 MB cada)'}</span>
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleArquivos} className="sr-only" />
                </label>
              </div>
            </div>
          )}

          {/* Botões de Rodapé */}
          <div className="mt-6 sm:mt-8 pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
            {etapa > 1 ? (
              <button
                type="button"
                onClick={() => setEtapa((prev) => (prev - 1) as any)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-500 hover:text-stone-800 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
            )}

            {etapa < 3 ? (
              <button
                type="button"
                onClick={avancarEtapa}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] active:bg-[#54101a] border border-[#c59b4c]/30 rounded-lg shadow-xs transition cursor-pointer"
              >
                <span>Próximo Passo</span>
                <ArrowRight className="w-4 h-4 text-[#dfc28d]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 px-6 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-lg shadow-xs transition cursor-pointer"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{salvando ? 'Criando e enviando…' : 'Criar Processo de Distrato'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
