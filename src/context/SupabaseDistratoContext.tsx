import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  Distrato,
  Usuario,
  Notificacao,
  Verificacao,
  Pagamento,
  Boleto,
  HistoricoAlteracao,
  Anexo,
} from "../types";
import { criarVerificacoesPadrao } from "../data/mockData";
import {
  atualizarStatusAutomaticos,
  calcularDividaTotal,
  calcularSaldoRestante,
} from "../utils/calculations";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

interface DistratoContextType {
  usuarios: Usuario[];
  usuarioAtual: Usuario;
  trocarUsuario: (usuarioId: string) => void;
  distratos: Distrato[];
  notificacoes: Notificacao[];
  distratoSelecionadoId: string | null;
  selecionarDistrato: (id: string | null) => void;
  criarDistrato: (dados: {
    agregadoNome: string;
    empresaNome?: string;
    placaCavalo: string;
    placaCarreta: string;
    dataEngateInicial?: string;
    dataEngateFinal?: string;
    tipoDistrato: Distrato["tipoDistrato"];
    gridOperacao: string;
    segmento: string;
    debitoAluguel: number;
    statusTermoAgregacao: Distrato["statusTermoAgregacao"];
  }) => string;
  atualizarDadosCadastrais: (
    distratoId: string,
    dados: Partial<
      Pick<
        Distrato,
        | "agregadoNome"
        | "empresaNome"
        | "placaCavalo"
        | "placaCarreta"
        | "dataEngateInicial"
        | "dataEngateFinal"
        | "tipoDistrato"
        | "gridOperacao"
        | "segmento"
        | "debitoAluguel"
        | "statusTermoAgregacao"
        | "responsavelAtualId"
        | "responsavelAtualNome"
      >
    >,
  ) => void;
  excluirDistrato: (distratoId: string) => Promise<void>;
  atualizarVerificacao: (
    distratoId: string,
    verificacaoId: string,
    novosDados: Partial<Verificacao>,
  ) => void;
  adicionarPagamento: (
    distratoId: string,
    pagamento: {
      data: string;
      valor: number;
      formaPagamento: Pagamento["formaPagamento"];
      categoria?: Pagamento["categoria"];
      dividaId?: string;
      dividaDescricao?: string;
      verificacaoId?: string;
      lancamentoId?: string;
      lotePagamentoId?: string;
      comprovanteNome?: string;
      comprovanteUrl?: string;
      observacao?: string;
    },
  ) => void;
  cancelarPagamento: (
    distratoId: string,
    pagamentoId: string,
    justificativa: string,
  ) => void;
  registrarBoletoAnexado: (
    distratoId: string,
    dados: {
      dataVencimento: string;
      valor: number;
      linhaDigitavel?: string;
      arquivoNome: string;
      arquivoUrl: string;
    },
  ) => void;
  emitirDistratoTermo: (distratoId: string, formaPagamento: string) => void;
  conferirDocumentosProtesto: (distratoId: string) => void;
  encaminharParaProtesto: (
    distratoId: string,
    cartorio: string,
    custas: number,
    dataEnvio: string,
    comprovanteId: string,
  ) => void;
  efetivarProtesto: (
    distratoId: string,
    dataEfetivacao: string,
    comprovanteId: string,
    obs?: string,
  ) => void;
  encaminharParaAjuizamento: (
    distratoId: string,
    dadosJudiciais: {
      numeroProcesso: string;
      varaComarca: string;
      valorAcao: number;
      observacoes?: string;
      comprovanteId: string;
    },
  ) => void;
  adicionarDocumento: (
    distratoId: string,
    doc: {
      nome: string;
      tipo: string;
      tamanhoKb: number;
      categoria?: string;
      descricao?: string;
      origem?: Anexo["origem"];
      url?: string;
    },
  ) => void;
  substituirAnexosLancamento: (
    distratoId: string,
    verificacaoId: string,
    lancamentoId: string,
    anexos: Anexo[],
  ) => void;
  marcarNotificacaoComoLida: (id: string) => void;
  marcarTodasNotificacoesLidas: () => void;
  reabrirDistrato: (distratoId: string, justificativa: string) => void;
  finalizarDistrato: (distratoId: string) => void;
  adicionarHistoricoManual: (
    distratoId: string,
    campo: string,
    de: string,
    para: string,
    justificativa?: string,
  ) => void;
  carregandoDados: boolean;
  erroDados: string | null;
  estadoSalvamento: "salvo" | "salvando" | "erro";
  tentarSalvarNovamente: () => void;
}

const DistratoContext = createContext<DistratoContextType | null>(null);

// Registros antigos guardavam o nome da empresa como responsável pelo custo.
const normalizarResponsavelCusto = <T extends { responsavelCusto?: string }>(item: T): T =>
  item.responsavelCusto && item.responsavelCusto !== "Agregado"
    ? { ...item, responsavelCusto: "Empresa" }
    : item;

export const DistratoProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { perfil } = useAuth();
  const usuarioAtual = perfil as Usuario;
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [distratos, setDistratos] = useState<Distrato[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const [estadoSalvamento, setEstadoSalvamento] = useState<
    "salvo" | "salvando" | "erro"
  >("salvo");
  const [tentativa, setTentativa] = useState(0);
  const salvos = useRef(new Map<string, string>());
  const atuais = useRef<Distrato[]>([]);
  const gravando = useRef(false);
  const [versao, setVersao] = useState(0);
  const hidratado = useRef(false);

  const [distratoSelecionadoId, setDistratoSelecionadoId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const carregar = async () => {
      setCarregandoDados(true);
      setErroDados(null);
      const [resDistratos, resNotificacoes, resUsuarios] = await Promise.all([
        supabase
          .from("distratos")
          .select("id,dados")
          .order("updated_at", { ascending: false }),
        supabase
          .from("notificacoes")
          .select("id,dados")
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .eq("aprovado", true)
          .eq("ativo", true),
      ]);
      const falha =
        resDistratos.error || resNotificacoes.error || resUsuarios.error;
      if (falha) {
        setErroDados(falha.message);
        setCarregandoDados(false);
        return;
      }
      const iniciais = (resDistratos.data || []).map((row: any) => {
        const distrato = row.dados as Distrato;
        const modelos = criarVerificacoesPadrao(distrato.id, distrato.debitoAluguel || 0);
        const idsLancamentosVistos = new Set<string>();
        const verificacoes = modelos.map((modelo) => {
          const existente = distrato.verificacoes?.find((item) => item.tipo === modelo.tipo);
          if (!existente) return modelo;
          const lancamentosOriginais = (existente.lancamentos || modelo.lancamentos || []).map(normalizarResponsavelCusto);
          const lancamentos = lancamentosOriginais
            .filter((lancamento) => {
              if (idsLancamentosVistos.has(lancamento.id)) return false;
              idsLancamentosVistos.add(lancamento.id);
              return true;
            })
            .map((lancamento) =>
              existente.tipo === "suprimentos" && !lancamento.auditoriaTipo
                ? {
                    ...lancamento,
                    auditoriaTipo: "Nova pendência" as const,
                    auditoriaStatus: "Concluída" as const,
                    auditoriaConclusao: "Nova pendência confirmada" as const,
                    auditoriaCondicao:
                      lancamento.observacoes || "Pendência registrada antes da atualização do fluxo de auditoria.",
                    auditoriaSeveridade: "Média" as const,
                    valorAuditado: Number(lancamento.valor || 0),
                  }
                : lancamento,
          );
          const valorLancamentos = lancamentos.reduce(
            (total, lancamento) => total + (lancamento.auditoriaTipo === "Conferência" ? 0 : Number(lancamento.valor || 0)),
            0,
          );
          const perdeuDuplicados = lancamentos.length < lancamentosOriginais.length;
          return {
            ...modelo,
            ...normalizarResponsavelCusto(existente),
            id: modelo.id,
            tipo: modelo.tipo,
            titulo: modelo.titulo,
            descricao: modelo.descricao,
            valor: lancamentosOriginais.length ? valorLancamentos : existente.valor,
            status: perdeuDuplicados && lancamentos.length === 0
              ? "Aguardando análise"
              : existente.tipo !== "suprimentos" && lancamentos.length
                ? valorLancamentos > 0 ? "Pendência encontrada" : "Sem pendências"
                : existente.status,
            lancamentos,
          };
        });
        const hidratado = {
          ...distrato,
          statusGeral:
            distrato.statusGeral === "Quitado" ? "Em andamento" : distrato.statusGeral,
          verificacoes,
        } as Distrato;
        return { ...hidratado, ...atualizarStatusAutomaticos(hidratado) } as Distrato;
      });
      salvos.current = new Map(
        iniciais.map((d: Distrato) => [d.id, JSON.stringify(d)]),
      );
      atuais.current = iniciais;
      setDistratos(iniciais);
      setNotificacoes(
        (resNotificacoes.data || []).map(
          (row: any) => row.dados as Notificacao,
        ),
      );
      setUsuarios(
        (resUsuarios.data || []).map((u: any) => ({
          id: u.id,
          nome: u.nome,
          email: u.email,
          perfil: u.perfil,
          departamento: u.departamento || "",
          departamentos: Array.isArray(u.departamentos) ? u.departamentos : [],
          cargo: u.cargo || "",
          avatar: u.avatar_url || undefined,
        })),
      );
      hidratado.current = true;
      setCarregandoDados(false);
    };
    carregar();
  }, []);

  useEffect(() => {
    if (!hidratado.current || !usuarioAtual) return;
    atuais.current = distratos;
    const pendentes = () =>
      atuais.current.filter(
        (d) => salvos.current.get(d.id) !== JSON.stringify(d),
      );
    if (!pendentes().length) {
      if (!gravando.current) setEstadoSalvamento("salvo");
      return;
    }
    setEstadoSalvamento("salvando");
    const timer = window.setTimeout(async () => {
      if (gravando.current) return;
      gravando.current = true;
      let houveErro = false;
      try {
        // Uma gravação por vez impede que respostas fora de ordem sobrescrevam
        // uma alteração mais recente feita nesta mesma janela.
        while (pendentes().length) {
          const d = pendentes()[0];
          const conteudo = JSON.stringify(d);
          const { error } = await supabase.from("distratos").upsert({
            id: d.id,
            dados: d,
            updated_at: new Date().toISOString(),
            updated_by: usuarioAtual.id,
          });
          if (error) throw error;
          salvos.current.set(d.id, conteudo);
        }
        setErroDados(null);
        setEstadoSalvamento("salvo");
      } catch (error) {
        houveErro = true;
        setErroDados(
          error instanceof Error
            ? error.message
            : "Não foi possível gravar os dados.",
        );
        setEstadoSalvamento("erro");
      } finally {
        gravando.current = false;
        if (pendentes().length && !houveErro) setVersao((v) => v + 1);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [distratos, usuarioAtual?.id, tentativa, versao]);

  useEffect(() => {
    const avisar = (event: BeforeUnloadEvent) => {
      if (estadoSalvamento !== "salvo") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [estadoSalvamento]);

  const tentarSalvarNovamente = () => {
    setErroDados(null);
    setEstadoSalvamento("salvando");
    setTentativa((n) => n + 1);
  };

  useEffect(() => {
    if (!hidratado.current || !usuarioAtual) return;
    const timer = window.setTimeout(async () => {
      if (notificacoes.length) {
        const { error } = await supabase.from("notificacoes").upsert(
          notificacoes.map((n) => ({
            id: n.id,
            dados: n,
            updated_at: new Date().toISOString(),
          })),
        );
        if (error) setErroDados(error.message);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [notificacoes, usuarioAtual?.id]);

  const trocarUsuario = (usuarioId: string) => {
    console.warn(
      "A troca de usuário foi desativada. Encerre a sessão e entre com outra conta.",
      usuarioId,
    );
  };

  const selecionarDistrato = (id: string | null) => {
    setDistratoSelecionadoId(id);
  };

  const criarDistrato = (dados: {
    agregadoNome: string;
    empresaNome?: string;
    placaCavalo: string;
    placaCarreta: string;
    dataEngateInicial?: string;
    dataEngateFinal?: string;
    tipoDistrato: Distrato["tipoDistrato"];
    gridOperacao: string;
    segmento: string;
    debitoAluguel: number;
    statusTermoAgregacao: Distrato["statusTermoAgregacao"];
  }): string => {
    const anoAtual = new Date().getFullYear();
    const maiorNumeroDistrato = distratos.reduce((maior, item) => {
      const correspondencia = item.id.match(
        new RegExp(`^DIS-${anoAtual}-(\\d+)$`),
      );
      return correspondencia
        ? Math.max(maior, Number(correspondencia[1]))
        : maior;
    }, 0);
    const maiorCodigoAgregado = distratos.reduce((maior, item) => {
      const correspondencia = item.agregadoCodigo?.match(/(\d+)$/);
      return correspondencia
        ? Math.max(maior, Number(correspondencia[1]))
        : maior;
    }, 999);
    const novoId = `DIS-${anoAtual}-${String(maiorNumeroDistrato + 1).padStart(3, "0")}`;
    const novoCodigoAgregado = `AGR-TP-${maiorCodigoAgregado + 1}`;
    const agoraIso = new Date().toISOString();
    const hoje = agoraIso.split("T")[0];

    const novoDistrato: Distrato = {
      id: novoId,
      agregadoId: `agr-${Date.now()}`,
      agregadoNome: dados.agregadoNome,
      empresaNome: dados.empresaNome?.trim() || undefined,
      agregadoCodigo: novoCodigoAgregado,
      dataSolicitacao: hoje,
      statusTermoAgregacao: dados.statusTermoAgregacao,
      placaCavalo: dados.placaCavalo.toUpperCase().trim(),
      placaCarreta: dados.placaCarreta.toUpperCase().trim(),
      dataEngateInicial: dados.dataEngateInicial || undefined,
      dataEngateFinal: dados.dataEngateFinal || undefined,
      debitoAluguel: Number(dados.debitoAluguel) || 0,
      gridOperacao: dados.gridOperacao,
      segmento: dados.segmento,
      tipoDistrato: dados.tipoDistrato,
      responsavelAtualId: usuarioAtual.id,
      responsavelAtualNome: usuarioAtual.nome,
      statusGeral: "Em andamento",
      statusFinanceiro: "Aguardando boleto",
      dataCriacao: agoraIso,
      dataUltimaAtualizacao: agoraIso,
      solicitouEmissaoBoleto: false,
      docsConferidosProtesto: false,
      encaminhadoProtesto: false,
      encaminhadoAjuizamento: false,
      verificacoes: criarVerificacoesPadrao(novoId, Number(dados.debitoAluguel) || 0),
      pagamentos: [],
      boletos: [],
      documentos: [],
      historico: [
        {
          id: `hist-${Date.now()}`,
          distratoId: novoId,
          dataHora: agoraIso,
          usuarioId: usuarioAtual.id,
          usuarioNome: usuarioAtual.nome,
          perfil: usuarioAtual.perfil,
          campoAlterado: "Criação do Processo",
          valorAnterior: "Inexistente",
          valorNovo: `Distrato ${novoId} iniciado para ${dados.agregadoNome}`,
        },
      ],
    };

    setDistratos((prev) => [novoDistrato, ...prev]);

    // Criar notificação para áreas
    const novaNotif: Notificacao = {
      id: `notif-${Date.now()}`,
      distratoId: novoId,
      tipo: "atribuicao",
      titulo: "Novo Distrato Cadastrado",
      mensagem: `O distrato ${novoId} (${dados.agregadoNome}) foi criado e aguarda auditorias.`,
      dataHora: agoraIso,
      lida: false,
      perfilDestino: "todos",
      linkDistratoId: novoId,
    };
    setNotificacoes((prev) => [novaNotif, ...prev]);

    return novoId;
  };

  const atualizarVerificacao = (
    distratoId: string,
    verificacaoId: string,
    novosDados: Partial<Verificacao>,
  ) => {
    const agoraIso = new Date().toISOString();

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const verificacoesAtualizadas = d.verificacoes.map((v) => {
          if (v.id !== verificacaoId) return v;

          const verAtualizada: Verificacao = {
            ...v,
            ...novosDados,
            id: v.id,
            tipo: v.tipo,
            titulo: v.titulo,
            descricao: v.descricao,
            responsavelId: usuarioAtual.id,
            responsavelNome: usuarioAtual.nome,
            dataAuditoria: novosDados.dataAuditoria || agoraIso.split("T")[0],
          };
          return verAtualizada;
        });

        const distratoModificado: Distrato = {
          ...d,
          verificacoes: verificacoesAtualizadas,
          dataUltimaAtualizacao: agoraIso,
        };

        const { statusGeral, statusFinanceiro } =
          atualizarStatusAutomaticos(distratoModificado);
        distratoModificado.statusGeral = statusGeral;
        distratoModificado.statusFinanceiro = statusFinanceiro;

        // Registrar no histórico
        const verOriginal = d.verificacoes.find((v) => v.id === verificacaoId);
        const mudanca = `Status: ${verOriginal?.status} -> ${novosDados.status || verOriginal?.status} | Valor: R$ ${verOriginal?.valor || 0} -> R$ ${novosDados.valor !== undefined ? novosDados.valor : verOriginal?.valor || 0}`;

        distratoModificado.historico = [
          {
            id: `hist-${Date.now()}`,
            distratoId: d.id,
            dataHora: agoraIso,
            usuarioId: usuarioAtual.id,
            usuarioNome: usuarioAtual.nome,
            perfil: usuarioAtual.perfil,
            campoAlterado: `Auditoria: ${verOriginal?.titulo}`,
            valorAnterior: `Status: ${verOriginal?.status}, R$ ${verOriginal?.valor}`,
            valorNovo: mudanca,
            justificativa: novosDados.observacoes,
          },
          ...d.historico,
        ];

        return distratoModificado;
      }),
    );
  };

  const atualizarDadosCadastrais = (
    distratoId: string,
    dados: Partial<
      Pick<
        Distrato,
        | "agregadoNome"
        | "placaCavalo"
        | "placaCarreta"
        | "tipoDistrato"
        | "gridOperacao"
        | "segmento"
        | "debitoAluguel"
        | "statusTermoAgregacao"
        | "responsavelAtualId"
        | "responsavelAtualNome"
      >
    >,
  ) => {
    const agoraIso = new Date().toISOString();
    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;
        const atualizado: Distrato = {
          ...d,
          ...dados,
          placaCavalo: dados.placaCavalo?.toUpperCase().trim() ?? d.placaCavalo,
          placaCarreta:
            dados.placaCarreta?.toUpperCase().trim() ?? d.placaCarreta,
          debitoAluguel:
            dados.debitoAluguel !== undefined
              ? Math.max(0, Number(dados.debitoAluguel) || 0)
              : d.debitoAluguel,
          dataUltimaAtualizacao: agoraIso,
        };
        atualizado.historico = [
          {
            id: `hist-${Date.now()}`,
            distratoId: d.id,
            dataHora: agoraIso,
            usuarioId: usuarioAtual.id,
            usuarioNome: usuarioAtual.nome,
            perfil: usuarioAtual.perfil,
            campoAlterado: "Dados cadastrais do distrato",
            valorAnterior: `${d.agregadoNome} | ${d.placaCavalo} / ${d.placaCarreta} | ${d.gridOperacao} / ${d.segmento} | Aluguel: R$ ${d.debitoAluguel.toFixed(2)}`,
            valorNovo: `${atualizado.agregadoNome} | ${atualizado.placaCavalo} / ${atualizado.placaCarreta} | ${atualizado.gridOperacao} / ${atualizado.segmento} | Aluguel: R$ ${atualizado.debitoAluguel.toFixed(2)}`,
          },
          ...d.historico,
        ];
        return atualizado;
      }),
    );
  };

  const excluirDistrato = async (distratoId: string) => {
    const distrato = atuais.current.find((item) => item.id === distratoId);
    if (!distrato) throw new Error("Distrato não encontrado.");

    const { error } = await supabase.from("distratos").delete().eq("id", distratoId);
    if (error) throw error;

    // Limpeza auxiliar; instalações antigas podem ainda não ter a política de
    // exclusão de notificações, por isso uma falha aqui não desfaz o distrato.
    await supabase
      .from("notificacoes")
      .delete()
      .or(`dados->>distratoId.eq.${distratoId},dados->>linkDistratoId.eq.${distratoId}`);

    const caminhos = Array.from(
      new Set(
        [
          ...distrato.documentos.map((doc) => doc.url),
          ...distrato.boletos.map((boleto) => boleto.arquivoUrl),
          ...distrato.pagamentos.map((pagamento) => pagamento.comprovanteUrl),
          ...distrato.verificacoes.flatMap((verificacao) => [
            ...verificacao.anexos.map((anexo) => anexo.url),
            ...(verificacao.lancamentos || []).flatMap((lancamento) =>
              lancamento.anexos.map((anexo) => anexo.url),
            ),
          ]),
        ].filter((caminho): caminho is string => Boolean(caminho)),
      ),
    );
    if (caminhos.length) {
      // A exclusão do registro é a operação principal. Arquivos órfãos não
      // impedem a conclusão caso o Storage esteja temporariamente indisponível.
      await supabase.storage.from("documentos-distratos").remove(caminhos);
    }

    salvos.current.delete(distratoId);
    atuais.current = atuais.current.filter((item) => item.id !== distratoId);
    setDistratos((prev) => prev.filter((item) => item.id !== distratoId));
    setNotificacoes((prev) =>
      prev.filter(
        (notificacao) =>
          notificacao.distratoId !== distratoId &&
          notificacao.linkDistratoId !== distratoId,
      ),
    );
    setDistratoSelecionadoId(null);
  };

  const adicionarPagamento = (
    distratoId: string,
    pagamento: {
      data: string;
      valor: number;
      formaPagamento: Pagamento["formaPagamento"];
      categoria?: Pagamento["categoria"];
      dividaId?: string;
      dividaDescricao?: string;
      verificacaoId?: string;
      lancamentoId?: string;
      lotePagamentoId?: string;
      comprovanteNome?: string;
      comprovanteUrl?: string;
      observacao?: string;
    },
  ) => {
    const agoraIso = new Date().toISOString();
    const novoPag: Pagamento = {
      id: `pag-${crypto.randomUUID()}`,
      distratoId,
      data: pagamento.data,
      valor: Number(pagamento.valor),
      categoria: pagamento.categoria || "Outros",
      dividaId: pagamento.dividaId,
      dividaDescricao: pagamento.dividaDescricao,
      verificacaoId: pagamento.verificacaoId,
      lancamentoId: pagamento.lancamentoId,
      lotePagamentoId: pagamento.lotePagamentoId,
      formaPagamento: pagamento.formaPagamento,
      comprovanteNome: pagamento.comprovanteNome,
      comprovanteUrl: pagamento.comprovanteUrl,
      observacao: pagamento.observacao,
      usuarioId: usuarioAtual.id,
      usuarioNome: usuarioAtual.nome,
      cancelado: false,
    };

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const pagamentosAtualizados = [novoPag, ...d.pagamentos];
        const distratoModificado: Distrato = {
          ...d,
          pagamentos: pagamentosAtualizados,
          dataUltimaAtualizacao: agoraIso,
        };

        const { statusGeral, statusFinanceiro } =
          atualizarStatusAutomaticos(distratoModificado);
        distratoModificado.statusGeral = statusGeral;
        distratoModificado.statusFinanceiro = statusFinanceiro;

        distratoModificado.historico = [
          {
            id: `hist-${Date.now()}`,
            distratoId: d.id,
            dataHora: agoraIso,
            usuarioId: usuarioAtual.id,
            usuarioNome: usuarioAtual.nome,
            perfil: usuarioAtual.perfil,
            campoAlterado: "Novo Pagamento Registrado",
            valorAnterior: "Saldo pendente",
            valorNovo: `Recebido R$ ${novoPag.valor.toFixed(2)} via ${novoPag.formaPagamento} • Categoria: ${novoPag.categoria}${novoPag.dividaDescricao ? ` • Dívida: ${novoPag.dividaDescricao}` : ""}`,
            justificativa: pagamento.observacao,
          },
          ...d.historico,
        ];

        return distratoModificado;
      }),
    );

    // Notificação de pagamento ou quitação
    setTimeout(() => {
      const d = distratos.find((item) => item.id === distratoId);
      if (d) {
        const saldo = calcularSaldoRestante(d) - pagamento.valor;
        const eQuitacao = saldo <= 0.009;

        const notif: Notificacao = {
          id: `notif-${Date.now()}`,
          distratoId,
          tipo: eQuitacao ? "quitacao" : "pagamento",
          titulo: eQuitacao
            ? "Processo 100% Quitado!"
            : "Pagamento Parcial Confirmado",
          mensagem: eQuitacao
            ? `O distrato ${distratoId} atingiu saldo R$ 0,00 e foi totalmente liquidado.`
            : `Recebido valor de R$ ${pagamento.valor.toFixed(2)} para o distrato ${distratoId}.`,
          dataHora: agoraIso,
          lida: false,
          perfilDestino: "financeiro",
          linkDistratoId: distratoId,
        };
        setNotificacoes((prev) => [notif, ...prev]);
      }
    }, 100);
  };

  const cancelarPagamento = (
    distratoId: string,
    pagamentoId: string,
    justificativa: string,
  ) => {
    const agoraIso = new Date().toISOString();

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        let valorEstornado = 0;
        const pagamentosAtualizados = d.pagamentos.map((p) => {
          if (p.id === pagamentoId) {
            valorEstornado = p.valor;
            return {
              ...p,
              cancelado: true,
              justificativaCancelamento: justificativa,
              dataCancelamento: agoraIso,
              usuarioCancelamentoNome: usuarioAtual.nome,
            };
          }
          return p;
        });

        const distratoModificado: Distrato = {
          ...d,
          pagamentos: pagamentosAtualizados,
          dataUltimaAtualizacao: agoraIso,
        };

        const { statusGeral, statusFinanceiro } =
          atualizarStatusAutomaticos(distratoModificado);
        distratoModificado.statusGeral = statusGeral;
        distratoModificado.statusFinanceiro = statusFinanceiro;

        distratoModificado.historico = [
          {
            id: `hist-${Date.now()}`,
            distratoId: d.id,
            dataHora: agoraIso,
            usuarioId: usuarioAtual.id,
            usuarioNome: usuarioAtual.nome,
            perfil: usuarioAtual.perfil,
            campoAlterado: "Cancelamento de Pagamento",
            valorAnterior: `Pagamento ativo de R$ ${valorEstornado.toFixed(2)}`,
            valorNovo: "Pagamento cancelado no sistema (não excluído)",
            justificativa: justificativa,
          },
          ...d.historico,
        ];

        return distratoModificado;
      }),
    );
  };

  const registrarBoletoAnexado = (
    distratoId: string,
    dados: {
      dataVencimento: string;
      valor: number;
      linhaDigitavel?: string;
      arquivoNome: string;
      arquivoUrl: string;
    },
  ) => {
    const agoraIso = new Date().toISOString();
    const hoje = agoraIso.split("T")[0];

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const novoBoleto: Boleto = {
          id: `bol-${Date.now()}`,
          distratoId,
          numeroDocumento: "",
          nossoNumero: "",
          dataEmissao: hoje,
          dataVencimento: dados.dataVencimento,
          valor: dados.valor,
          status: "A vencer",
          codigoBarras: dados.linhaDigitavel || "",
          linhaDigitavel: dados.linhaDigitavel,
          arquivoNome: dados.arquivoNome,
          arquivoUrl: dados.arquivoUrl,
        };

        const distratoModificado: Distrato = {
          ...d,
          solicitouEmissaoBoleto: true,
          dataSolicitacaoBoleto: d.dataSolicitacaoBoleto || hoje,
          dataEmissaoBoleto: hoje,
          dataVencimentoBoleto: dados.dataVencimento,
          boletos: [novoBoleto, ...d.boletos],
          dataUltimaAtualizacao: agoraIso,
        };

        const { statusGeral, statusFinanceiro } =
          atualizarStatusAutomaticos(distratoModificado);
        distratoModificado.statusGeral = statusGeral;
        distratoModificado.statusFinanceiro = statusFinanceiro;

        distratoModificado.historico = [
          {
            id: `hist-${Date.now()}`,
            distratoId: d.id,
            dataHora: agoraIso,
            usuarioId: usuarioAtual.id,
            usuarioNome: usuarioAtual.nome,
            perfil: usuarioAtual.perfil,
            campoAlterado: "Boleto anexado pelo Financeiro",
            valorAnterior: d.dataEmissaoBoleto
              ? "Boleto anterior"
              : "Aguardando boleto",
            valorNovo: `${dados.arquivoNome} • R$ ${dados.valor.toFixed(2)} • vencimento ${dados.dataVencimento}`,
          },
          ...d.historico,
        ];

        return distratoModificado;
      }),
    );
  };

  const emitirDistratoTermo = (distratoId: string, formaPagamento: string) => {
    const agoraIso = new Date().toISOString();
    const hoje = agoraIso.split("T")[0];

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const distratoModificado: Distrato = {
          ...d,
          dataEmissaoDistrato: hoje,
          dataEnvioAgregado: hoje,
          formaPagamento,
          statusGeral: "Distrato Emitido",
          dataUltimaAtualizacao: agoraIso,
        };

        const { statusGeral, statusFinanceiro } =
          atualizarStatusAutomaticos(distratoModificado);
        distratoModificado.statusGeral = statusGeral;
        distratoModificado.statusFinanceiro = statusFinanceiro;

        distratoModificado.historico = [
          {
            id: `hist-${Date.now()}`,
            distratoId: d.id,
            dataHora: agoraIso,
            usuarioId: usuarioAtual.id,
            usuarioNome: usuarioAtual.nome,
            perfil: usuarioAtual.perfil,
            campoAlterado: "Emissão do Termo de Distrato",
            valorAnterior: "Aguardando Emissão",
            valorNovo: `Emitido e enviado ao agregado (${formaPagamento})`,
          },
          ...d.historico,
        ];

        return distratoModificado;
      }),
    );
  };

  const conferirDocumentosProtesto = (distratoId: string) => {
    const agoraIso = new Date().toISOString();
    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const distratoModificado: Distrato = {
          ...d,
          docsConferidosProtesto: true,
          docsConferidosData: agoraIso.split("T")[0],
          docsConferidosUsuario: usuarioAtual.nome,
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: "Conferência de Documentos para Protesto",
              valorAnterior: "Não conferido",
              valorNovo: "Conferido e validado para cartório",
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      }),
    );
  };

  const encaminharParaProtesto = (
    distratoId: string,
    cartorio: string,
    custas: number,
    dataEnvio: string,
    comprovanteId: string,
  ) => {
    const agoraIso = new Date().toISOString();

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const comprovante = d.documentos.find(
          (doc) => doc.id === comprovanteId && doc.url,
        );
        if (!comprovante) return d;

        const distratoModificado: Distrato = {
          ...d,
          encaminhadoProtesto: true,
          comprovanteProtestoId: comprovante.id,
          dataEnvioProtesto: dataEnvio,
          cartorioProtesto: cartorio,
          custasCartorio: custas,
          statusGeral: "Em Protesto",
          statusFinanceiro: "Encaminhado para protesto",
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: "Envio para Cartório de Protesto",
              valorAnterior: d.statusGeral,
              valorNovo: `Enviado a ${cartorio} (Custas R$ ${custas.toFixed(2)}). Comprovante: ${comprovante.nome} (${comprovante.id})`,
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      }),
    );
  };

  const efetivarProtesto = (
    distratoId: string,
    dataEfetivacao: string,
    comprovanteId: string,
    obs?: string,
  ) => {
    const agoraIso = new Date().toISOString();

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const comprovante = d.documentos.find(
          (doc) => doc.id === comprovanteId && doc.url,
        );
        if (!d.encaminhadoProtesto || d.dataEfetivacaoProtesto || !comprovante)
          return d;

        const distratoModificado: Distrato = {
          ...d,
          dataEfetivacaoProtesto: dataEfetivacao,
          comprovanteEfetivacaoProtestoId: comprovante.id,
          observacoesJuridicas: obs
            ? `${d.observacoesJuridicas || ""} \n${obs}`.trim()
            : d.observacoesJuridicas,
          statusGeral: "Em Protesto",
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: "Efetivação do Protesto em Cartório",
              valorAnterior: "Em envio",
              valorNovo: `Protesto lavrado na data ${dataEfetivacao}. Comprovante: ${comprovante.nome} (${comprovante.id})`,
              justificativa: obs,
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      }),
    );
  };

  const encaminharParaAjuizamento = (
    distratoId: string,
    dadosJudiciais: {
      numeroProcesso: string;
      varaComarca: string;
      valorAcao: number;
      observacoes?: string;
      comprovanteId: string;
    },
  ) => {
    const agoraIso = new Date().toISOString();
    const hoje = agoraIso.split("T")[0];

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const comprovante = d.documentos.find(
          (doc) => doc.id === dadosJudiciais.comprovanteId && doc.url,
        );
        if (!comprovante) return d;

        const distratoModificado: Distrato = {
          ...d,
          encaminhadoAjuizamento: true,
          comprovanteAjuizamentoId: comprovante.id,
          dataAjuizamento: hoje,
          numeroProcessoJudicial: dadosJudiciais.numeroProcesso,
          varaComarca: dadosJudiciais.varaComarca,
          valorAcaoJudicial: dadosJudiciais.valorAcao,
          observacoesJuridicas:
            dadosJudiciais.observacoes || d.observacoesJuridicas,
          statusGeral: "Ajuizado",
          statusFinanceiro: "Em processo judicial",
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: "Ajuizamento de Ação Judicial",
              valorAnterior: d.statusGeral,
              valorNovo: `Processo nº ${dadosJudiciais.numeroProcesso} (${dadosJudiciais.varaComarca}) - Valor R$ ${dadosJudiciais.valorAcao.toFixed(2)}. Comprovante: ${comprovante.nome} (${comprovante.id})`,
              justificativa: dadosJudiciais.observacoes,
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      }),
    );
  };

  const adicionarDocumento = (
    distratoId: string,
    doc: {
      nome: string;
      tipo: string;
      tamanhoKb: number;
      categoria?: string;
      descricao?: string;
      origem?: Anexo["origem"];
      url?: string;
    },
  ) => {
    const agoraIso = new Date().toISOString();
    const novoAnexo: Anexo = {
      id: `doc-${Date.now()}`,
      nome: doc.nome,
      tipo: doc.tipo,
      tamanhoKb: doc.tamanhoKb,
      dataUpload: agoraIso,
      usuarioId: usuarioAtual.id,
      usuarioNome: usuarioAtual.nome,
      categoria: doc.categoria || "Geral",
      descricao: doc.descricao?.trim() || "",
      origem: doc.origem || "Documentos gerais",
      url: doc.url,
    };

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;
        return {
          ...d,
          documentos: [novoAnexo, ...d.documentos],
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: "Upload de Documento",
              valorAnterior: "N/A",
              valorNovo: `Arquivo anexado: ${doc.nome} (${doc.categoria || "Geral"})${doc.descricao ? ` • ${doc.descricao}` : ""}`,
            },
            ...d.historico,
          ],
        };
      }),
    );
  };

  const substituirAnexosLancamento = (
    distratoId: string,
    verificacaoId: string,
    lancamentoId: string,
    anexos: Anexo[],
  ) => {
    const agoraIso = new Date().toISOString();
    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;
        const verificacao = d.verificacoes.find((item) => item.id === verificacaoId);
        const lancamento = verificacao?.lancamentos?.find((item) => item.id === lancamentoId);
        const idsAnteriores = new Set((lancamento?.anexos || []).map((item) => item.id));
        return {
          ...d,
          verificacoes: d.verificacoes.map((item) =>
            item.id === verificacaoId
              ? {
                  ...item,
                  lancamentos: (item.lancamentos || []).map((registro) =>
                    registro.id === lancamentoId ? { ...registro, anexos } : registro,
                  ),
                  anexos: [
                    ...(item.anexos || []).filter((anexo) => !idsAnteriores.has(anexo.id)),
                    ...anexos,
                  ],
                }
              : item,
          ),
          documentos: [
            ...d.documentos.filter((anexo) => !idsAnteriores.has(anexo.id)),
            ...anexos,
          ],
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${crypto.randomUUID()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: "Anexos do lançamento",
              valorAnterior: `${idsAnteriores.size} arquivo(s)`,
              valorNovo: `${anexos.length} arquivo(s)`,
              justificativa: "Substituição realizada durante a edição do lançamento",
            },
            ...d.historico,
          ],
        };
      }),
    );
  };

  const reabrirDistrato = (distratoId: string, justificativa: string) => {
    const agoraIso = new Date().toISOString();
    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const distratoModificado: Distrato = {
          ...d,
          statusGeral: "Em andamento",
          statusFinanceiro: d.statusFinanceiro,
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: "Reabertura do Processo",
              valorAnterior: d.statusGeral,
              valorNovo: "Em Aberto (Reaberto pelo Supervisor)",
              justificativa,
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      }),
    );
  };

  const finalizarDistrato = (distratoId: string) => {
    const agoraIso = new Date().toISOString();
    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;
        if (calcularSaldoRestante(d) > 0.009) return d;
        return {
          ...d,
          statusGeral: "Finalizado",
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: "Finalização do Distrato",
              valorAnterior: d.statusGeral,
              valorNovo: "Finalizado",
              justificativa: "Encerramento formal após conclusão das verificações e quitação financeira.",
            },
            ...d.historico,
          ],
        };
      }),
    );
  };

  const adicionarHistoricoManual = (
    distratoId: string,
    campo: string,
    de: string,
    para: string,
    justificativa?: string,
  ) => {
    const agoraIso = new Date().toISOString();
    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;
        return {
          ...d,
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: campo,
              valorAnterior: de,
              valorNovo: para,
              justificativa,
            },
            ...d.historico,
          ],
        };
      }),
    );
  };

  const marcarNotificacaoComoLida = (id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    );
  };

  const marcarTodasNotificacoesLidas = () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  return (
    <DistratoContext.Provider
      value={{
        usuarios,
        usuarioAtual,
        trocarUsuario,
        distratos,
        notificacoes,
        distratoSelecionadoId,
        selecionarDistrato,
        criarDistrato,
        atualizarDadosCadastrais,
        excluirDistrato,
        atualizarVerificacao,
        adicionarPagamento,
        cancelarPagamento,
        registrarBoletoAnexado,
        emitirDistratoTermo,
        conferirDocumentosProtesto,
        encaminharParaProtesto,
        efetivarProtesto,
        encaminharParaAjuizamento,
        adicionarDocumento,
        substituirAnexosLancamento,
        marcarNotificacaoComoLida,
        marcarTodasNotificacoesLidas,
        reabrirDistrato,
        finalizarDistrato,
        adicionarHistoricoManual,
        carregandoDados,
        erroDados,
        estadoSalvamento,
        tentarSalvarNovamente,
      }}
    >
      {children}
    </DistratoContext.Provider>
  );
};

export const useDistratos = () => {
  const context = useContext(DistratoContext);
  if (!context) {
    throw new Error(
      "useDistratos deve ser usado dentro de um DistratoProvider",
    );
  }
  return context;
};
