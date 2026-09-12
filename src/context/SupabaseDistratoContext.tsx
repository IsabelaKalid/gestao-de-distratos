import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Distrato,
  Usuario,
  Notificacao,
  Verificacao,
  Pagamento,
  Boleto,
  HistoricoAlteracao,
  Anexo,
} from '../types';
import { DISTRATOS_INICIAIS, NOTIFICACOES_INICIAIS, criarVerificacoesPadrao } from '../data/mockData';
import { atualizarStatusAutomaticos, calcularDividaTotal, calcularSaldoRestante } from '../utils/calculations';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

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
    agregadoCodigo: string;
    placaCavalo: string;
    placaCarreta: string;
    tipoDistrato: Distrato['tipoDistrato'];
    gridOperacao: string;
    segmento: string;
    debitoAluguel: number;
    statusTermoAgregacao: Distrato['statusTermoAgregacao'];
  }) => string;
  atualizarVerificacao: (
    distratoId: string,
    verificacaoId: string,
    novosDados: Partial<Verificacao>
  ) => void;
  adicionarPagamento: (
    distratoId: string,
    pagamento: {
      data: string;
      valor: number;
      formaPagamento: Pagamento['formaPagamento'];
      comprovanteNome?: string;
      observacao?: string;
    }
  ) => void;
  cancelarPagamento: (
    distratoId: string,
    pagamentoId: string,
    justificativa: string
  ) => void;
  emitirBoleto: (distratoId: string, dataVencimento: string, valor?: number) => void;
  emitirDistratoTermo: (distratoId: string, formaPagamento: string) => void;
  conferirDocumentosProtesto: (distratoId: string) => void;
  encaminharParaProtesto: (
    distratoId: string,
    cartorio: string,
    custas: number,
    dataEnvio: string
  ) => void;
  efetivarProtesto: (distratoId: string, dataEfetivacao: string, obs?: string) => void;
  encaminharParaAjuizamento: (
    distratoId: string,
    dadosJudiciais: {
      numeroProcesso: string;
      varaComarca: string;
      valorAcao: number;
      observacoes?: string;
    }
  ) => void;
  adicionarDocumento: (
    distratoId: string,
    doc: { nome: string; tipo: string; tamanhoKb: number; categoria?: string; url?: string }
  ) => void;
  marcarNotificacaoComoLida: (id: string) => void;
  marcarTodasNotificacoesLidas: () => void;
  reabrirDistrato: (distratoId: string, justificativa: string) => void;
  adicionarHistoricoManual: (
    distratoId: string,
    campo: string,
    de: string,
    para: string,
    justificativa?: string
  ) => void;
  resetarDados: () => void;
  carregandoDados: boolean;
  erroDados: string | null;
}

const DistratoContext = createContext<DistratoContextType | null>(null);

export const DistratoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { perfil } = useAuth();
  const usuarioAtual = perfil as Usuario;
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [distratos, setDistratos] = useState<Distrato[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const hidratado = useRef(false);

  const [distratoSelecionadoId, setDistratoSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      setCarregandoDados(true); setErroDados(null);
      const [resDistratos, resNotificacoes, resUsuarios] = await Promise.all([
        supabase.from('distratos').select('id,dados').order('updated_at', { ascending: false }),
        supabase.from('notificacoes').select('id,dados').order('updated_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('aprovado', true).eq('ativo', true),
      ]);
      const falha = resDistratos.error || resNotificacoes.error || resUsuarios.error;
      if (falha) { setErroDados(falha.message); setCarregandoDados(false); return; }
      setDistratos((resDistratos.data || []).map((row: any) => row.dados as Distrato));
      setNotificacoes((resNotificacoes.data || []).map((row: any) => row.dados as Notificacao));
      setUsuarios((resUsuarios.data || []).map((u: any) => ({ id:u.id, nome:u.nome, email:u.email, perfil:u.perfil, departamento:u.departamento || '', cargo:u.cargo || '', avatar:u.avatar_url || undefined })));
      hidratado.current = true;
      setCarregandoDados(false);
    };
    carregar();
  }, []);

  useEffect(() => {
    if (!hidratado.current || !usuarioAtual) return;
    const timer = window.setTimeout(async () => {
      if (distratos.length) {
        const { error } = await supabase.from('distratos').upsert(distratos.map((d) => ({ id: d.id, dados: d, updated_at: new Date().toISOString(), updated_by: usuarioAtual.id })));
        if (error) setErroDados(error.message);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [distratos, usuarioAtual?.id]);

  useEffect(() => {
    if (!hidratado.current || !usuarioAtual) return;
    const timer = window.setTimeout(async () => {
      if (notificacoes.length) {
        const { error } = await supabase.from('notificacoes').upsert(notificacoes.map((n) => ({ id: n.id, dados: n, updated_at: new Date().toISOString() })));
        if (error) setErroDados(error.message);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [notificacoes, usuarioAtual?.id]);

  const trocarUsuario = (usuarioId: string) => {
    console.warn('A troca de usuário foi desativada. Encerre a sessão e entre com outra conta.', usuarioId);
  };

  const selecionarDistrato = (id: string | null) => {
    setDistratoSelecionadoId(id);
  };

  const criarDistrato = (dados: {
    agregadoNome: string;
    agregadoCodigo: string;
    placaCavalo: string;
    placaCarreta: string;
    tipoDistrato: Distrato['tipoDistrato'];
    gridOperacao: string;
    segmento: string;
    debitoAluguel: number;
    statusTermoAgregacao: Distrato['statusTermoAgregacao'];
  }): string => {
    const anoAtual = new Date().getFullYear();
    const count = distratos.length + 1;
    const novoId = `DIS-${anoAtual}-${String(count).padStart(3, '0')}`;
    const agoraIso = new Date().toISOString();
    const hoje = agoraIso.split('T')[0];

    const novoDistrato: Distrato = {
      id: novoId,
      agregadoId: `agr-${Date.now()}`,
      agregadoNome: dados.agregadoNome,
      agregadoCodigo: dados.agregadoCodigo,
      dataSolicitacao: hoje,
      statusTermoAgregacao: dados.statusTermoAgregacao,
      placaCavalo: dados.placaCavalo.toUpperCase().trim(),
      placaCarreta: dados.placaCarreta.toUpperCase().trim(),
      debitoAluguel: Number(dados.debitoAluguel) || 0,
      gridOperacao: dados.gridOperacao,
      segmento: dados.segmento,
      tipoDistrato: dados.tipoDistrato,
      responsavelAtualId: usuarioAtual.id,
      responsavelAtualNome: usuarioAtual.nome,
      statusGeral: 'Em Auditoria',
      statusFinanceiro: 'Aguardando boleto',
      dataCriacao: agoraIso,
      dataUltimaAtualizacao: agoraIso,
      solicitouEmissaoBoleto: false,
      docsConferidosProtesto: false,
      encaminhadoProtesto: false,
      encaminhadoAjuizamento: false,
      verificacoes: criarVerificacoesPadrao(novoId),
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
          campoAlterado: 'Criação do Processo',
          valorAnterior: 'Inexistente',
          valorNovo: `Distrato ${novoId} iniciado para ${dados.agregadoNome}`,
        },
      ],
    };

    setDistratos((prev) => [novoDistrato, ...prev]);

    // Criar notificação para áreas
    const novaNotif: Notificacao = {
      id: `notif-${Date.now()}`,
      distratoId: novoId,
      tipo: 'atribuicao',
      titulo: 'Novo Distrato Cadastrado',
      mensagem: `O distrato ${novoId} (${dados.agregadoNome}) foi criado e aguarda auditorias.`,
      dataHora: agoraIso,
      lida: false,
      perfilDestino: 'todos',
      linkDistratoId: novoId,
    };
    setNotificacoes((prev) => [novaNotif, ...prev]);

    return novoId;
  };

  const atualizarVerificacao = (
    distratoId: string,
    verificacaoId: string,
    novosDados: Partial<Verificacao>
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
            responsavelId: usuarioAtual.id,
            responsavelNome: usuarioAtual.nome,
            dataAuditoria: novosDados.dataAuditoria || agoraIso.split('T')[0],
          };
          return verAtualizada;
        });

        const distratoModificado: Distrato = {
          ...d,
          verificacoes: verificacoesAtualizadas,
          dataUltimaAtualizacao: agoraIso,
        };

        const { statusGeral, statusFinanceiro } = atualizarStatusAutomaticos(distratoModificado);
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
      })
    );
  };

  const adicionarPagamento = (
    distratoId: string,
    pagamento: {
      data: string;
      valor: number;
      formaPagamento: Pagamento['formaPagamento'];
      comprovanteNome?: string;
      observacao?: string;
    }
  ) => {
    const agoraIso = new Date().toISOString();
    const novoPag: Pagamento = {
      id: `pag-${Date.now()}`,
      distratoId,
      data: pagamento.data,
      valor: Number(pagamento.valor),
      formaPagamento: pagamento.formaPagamento,
      comprovanteNome: pagamento.comprovanteNome,
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

        const { statusGeral, statusFinanceiro } = atualizarStatusAutomaticos(distratoModificado);
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
            campoAlterado: 'Novo Pagamento Registrado',
            valorAnterior: 'Saldo pendente',
            valorNovo: `Recebido R$ ${novoPag.valor.toFixed(2)} via ${novoPag.formaPagamento}`,
            justificativa: pagamento.observacao,
          },
          ...d.historico,
        ];

        return distratoModificado;
      })
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
          tipo: eQuitacao ? 'quitacao' : 'pagamento',
          titulo: eQuitacao ? 'Processo 100% Quitado!' : 'Pagamento Parcial Confirmado',
          mensagem: eQuitacao
            ? `O distrato ${distratoId} atingiu saldo R$ 0,00 e foi totalmente liquidado.`
            : `Recebido valor de R$ ${pagamento.valor.toFixed(2)} para o distrato ${distratoId}.`,
          dataHora: agoraIso,
          lida: false,
          perfilDestino: 'financeiro',
          linkDistratoId: distratoId,
        };
        setNotificacoes((prev) => [notif, ...prev]);
      }
    }, 100);
  };

  const cancelarPagamento = (
    distratoId: string,
    pagamentoId: string,
    justificativa: string
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

        const { statusGeral, statusFinanceiro } = atualizarStatusAutomaticos(distratoModificado);
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
            campoAlterado: 'Cancelamento de Pagamento',
            valorAnterior: `Pagamento ativo de R$ ${valorEstornado.toFixed(2)}`,
            valorNovo: 'Pagamento cancelado no sistema (não excluído)',
            justificativa: justificativa,
          },
          ...d.historico,
        ];

        return distratoModificado;
      })
    );
  };

  const emitirBoleto = (distratoId: string, dataVencimento: string, valorEspecificado?: number) => {
    const agoraIso = new Date().toISOString();
    const hoje = agoraIso.split('T')[0];

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const saldoAtual = calcularSaldoRestante(d);
        const valorBoleto = valorEspecificado !== undefined && valorEspecificado > 0 ? valorEspecificado : saldoAtual;
        const randomNossoNumero = `${Math.floor(10000000 + Math.random() * 90000000)}-${Math.floor(Math.random() * 9)}`;
        const numDoc = `BOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const novoBoleto: Boleto = {
          id: `bol-${Date.now()}`,
          distratoId,
          numeroDocumento: numDoc,
          nossoNumero: `237/${randomNossoNumero}`,
          dataEmissao: hoje,
          dataVencimento,
          valor: valorBoleto,
          status: 'A vencer',
          codigoBarras: `23793.38128 60000.129381 20000.${randomNossoNumero.replace('-', '')} 1 9831000${Math.floor(valorBoleto * 100)}`,
        };

        const distratoModificado: Distrato = {
          ...d,
          solicitouEmissaoBoleto: true,
          dataSolicitacaoBoleto: d.dataSolicitacaoBoleto || hoje,
          dataEmissaoBoleto: hoje,
          dataVencimentoBoleto: dataVencimento,
          boletos: [novoBoleto, ...d.boletos],
          dataUltimaAtualizacao: agoraIso,
        };

        const { statusGeral, statusFinanceiro } = atualizarStatusAutomaticos(distratoModificado);
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
            campoAlterado: 'Emissão de Boleto Bancário',
            valorAnterior: d.dataEmissaoBoleto ? 'Boleto anterior' : 'Aguardando boleto',
            valorNovo: `${numDoc} emitido no valor de R$ ${valorBoleto.toFixed(2)}, vencto ${dataVencimento}`,
          },
          ...d.historico,
        ];

        return distratoModificado;
      })
    );
  };

  const emitirDistratoTermo = (distratoId: string, formaPagamento: string) => {
    const agoraIso = new Date().toISOString();
    const hoje = agoraIso.split('T')[0];

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const distratoModificado: Distrato = {
          ...d,
          dataEmissaoDistrato: hoje,
          dataEnvioAgregado: hoje,
          formaPagamento,
          statusGeral: 'Distrato Emitido',
          dataUltimaAtualizacao: agoraIso,
        };

        const { statusGeral, statusFinanceiro } = atualizarStatusAutomaticos(distratoModificado);
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
            campoAlterado: 'Emissão do Termo de Distrato',
            valorAnterior: 'Aguardando Emissão',
            valorNovo: `Emitido e enviado ao agregado (${formaPagamento})`,
          },
          ...d.historico,
        ];

        return distratoModificado;
      })
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
          docsConferidosData: agoraIso.split('T')[0],
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
              campoAlterado: 'Conferência de Documentos para Protesto',
              valorAnterior: 'Não conferido',
              valorNovo: 'Conferido e validado para cartório',
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      })
    );
  };

  const encaminharParaProtesto = (
    distratoId: string,
    cartorio: string,
    custas: number,
    dataEnvio: string
  ) => {
    const agoraIso = new Date().toISOString();

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const distratoModificado: Distrato = {
          ...d,
          encaminhadoProtesto: true,
          dataEnvioProtesto: dataEnvio,
          cartorioProtesto: cartorio,
          custasCartorio: custas,
          statusGeral: 'Em Protesto',
          statusFinanceiro: 'Encaminhado para protesto',
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: 'Envio para Cartório de Protesto',
              valorAnterior: d.statusGeral,
              valorNovo: `Enviado a ${cartorio} (Custas R$ ${custas.toFixed(2)})`,
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      })
    );
  };

  const efetivarProtesto = (distratoId: string, dataEfetivacao: string, obs?: string) => {
    const agoraIso = new Date().toISOString();

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const distratoModificado: Distrato = {
          ...d,
          dataEfetivacaoProtesto: dataEfetivacao,
          observacoesJuridicas: obs ? `${d.observacoesJuridicas || ''} \n${obs}`.trim() : d.observacoesJuridicas,
          statusGeral: 'Em Protesto',
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: 'Efetivação do Protesto em Cartório',
              valorAnterior: 'Em envio',
              valorNovo: `Protesto lavrado na data ${dataEfetivacao}`,
              justificativa: obs,
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      })
    );
  };

  const encaminharParaAjuizamento = (
    distratoId: string,
    dadosJudiciais: {
      numeroProcesso: string;
      varaComarca: string;
      valorAcao: number;
      observacoes?: string;
    }
  ) => {
    const agoraIso = new Date().toISOString();
    const hoje = agoraIso.split('T')[0];

    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const distratoModificado: Distrato = {
          ...d,
          encaminhadoAjuizamento: true,
          dataAjuizamento: hoje,
          numeroProcessoJudicial: dadosJudiciais.numeroProcesso,
          varaComarca: dadosJudiciais.varaComarca,
          valorAcaoJudicial: dadosJudiciais.valorAcao,
          observacoesJuridicas: dadosJudiciais.observacoes || d.observacoesJuridicas,
          statusGeral: 'Ajuizado',
          statusFinanceiro: 'Em processo judicial',
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: 'Ajuizamento de Ação Judicial',
              valorAnterior: d.statusGeral,
              valorNovo: `Processo nº ${dadosJudiciais.numeroProcesso} (${dadosJudiciais.varaComarca}) - Valor R$ ${dadosJudiciais.valorAcao.toFixed(2)}`,
              justificativa: dadosJudiciais.observacoes,
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      })
    );
  };

  const adicionarDocumento = (
    distratoId: string,
    doc: { nome: string; tipo: string; tamanhoKb: number; categoria?: string; url?: string }
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
      categoria: doc.categoria || 'Geral',
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
              campoAlterado: 'Upload de Documento',
              valorAnterior: 'N/A',
              valorNovo: `Arquivo anexado: ${doc.nome} (${doc.categoria})`,
            },
            ...d.historico,
          ],
        };
      })
    );
  };

  const reabrirDistrato = (distratoId: string, justificativa: string) => {
    const agoraIso = new Date().toISOString();
    setDistratos((prev) =>
      prev.map((d) => {
        if (d.id !== distratoId) return d;

        const distratoModificado: Distrato = {
          ...d,
          statusGeral: 'Em Aberto',
          statusFinanceiro: 'Aguardando boleto',
          dataUltimaAtualizacao: agoraIso,
          historico: [
            {
              id: `hist-${Date.now()}`,
              distratoId: d.id,
              dataHora: agoraIso,
              usuarioId: usuarioAtual.id,
              usuarioNome: usuarioAtual.nome,
              perfil: usuarioAtual.perfil,
              campoAlterado: 'Reabertura do Processo',
              valorAnterior: d.statusGeral,
              valorNovo: 'Em Aberto (Reaberto pelo Administrador)',
              justificativa,
            },
            ...d.historico,
          ],
        };

        return distratoModificado;
      })
    );
  };

  const adicionarHistoricoManual = (
    distratoId: string,
    campo: string,
    de: string,
    para: string,
    justificativa?: string
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
      })
    );
  };

  const marcarNotificacaoComoLida = (id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
  };

  const marcarTodasNotificacoesLidas = () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const resetarDados = () => {
    setDistratos(DISTRATOS_INICIAIS);
    setNotificacoes(NOTIFICACOES_INICIAIS);
    setDistratoSelecionadoId(null);
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
        marcarNotificacaoComoLida,
        marcarTodasNotificacoesLidas,
        reabrirDistrato,
        adicionarHistoricoManual,
        resetarDados,
        carregandoDados,
        erroDados,
      }}
    >
      {children}
    </DistratoContext.Provider>
  );
};

export const useDistratos = () => {
  const context = useContext(DistratoContext);
  if (!context) {
    throw new Error('useDistratos deve ser usado dentro de um DistratoProvider');
  }
  return context;
};
