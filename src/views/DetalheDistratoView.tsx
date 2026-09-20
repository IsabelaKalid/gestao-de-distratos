import React, { useRef, useState } from "react";
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
  Pencil,
  Download,
  Eye,
} from "lucide-react";
import { useDistratos } from "../context/DistratoContext";
import {
  formatarMoeda,
  formatarData,
  formatarDataHora,
  calcularDividaTotal,
  calcularTotalPago,
  calcularSaldoRestante,
} from "../utils/calculations";
import { StatusBadge } from "../components/StatusBadge";
import { supabase } from "../lib/supabase";
import {
  Verificacao,
  StatusVerificacao,
  Pagamento,
  Distrato,
  Anexo,
  LancamentoVerificacao,
} from "../types";

interface DetalheDistratoViewProps {
  distratoId: string;
  onVoltar: () => void;
  onOpenImprimir: () => void;
}


type DadosBoletoLeitura = {
  valor: string;
  vencimento: string;
  linhaDigitavel: string;
};

type ResultadoLeituraLocal = {
  dados: DadosBoletoLeitura;
  completo: boolean;
  linhaValida: boolean;
  valorConfiavel: boolean;
  vencimentoConfiavel: boolean;
  alertas: string[];
};

const formatarValorBoleto = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dataBrParaIso = (data: string) => {
  const partes = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return "";
  const [, dia, mes, ano] = partes;
  const dataUtc = new Date(
    Date.UTC(Number(ano), Number(mes) - 1, Number(dia)),
  );
  if (
    dataUtc.getUTCFullYear() !== Number(ano) ||
    dataUtc.getUTCMonth() !== Number(mes) - 1 ||
    dataUtc.getUTCDate() !== Number(dia)
  ) {
    return "";
  }
  return `${ano}-${mes}-${dia}`;
};

const valorTextoParaNumero = (valor: string) => {
  const texto = valor.trim();
  if (!texto) return 0;
  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");
  let normalizado = texto;
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const decimal = ultimaVirgula > ultimoPonto ? "," : ".";
    normalizado = texto
      .replace(decimal === "," ? /\./g : /,/g, "")
      .replace(decimal, ".");
  } else if (ultimaVirgula >= 0) {
    normalizado = texto.replace(",", ".");
  } else if (ultimoPonto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(texto)) {
    normalizado = texto.replace(/\./g, "");
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
};

const limparEntradaDecimal = (valor: string) =>
  valor
    .replace(/[^\d,.]/g, "")
    .replace(/([,.].*)[,.]/g, "$1");

const calcularDvModulo10 = (campo: string) => {
  let soma = 0;
  let peso = 2;
  for (let i = campo.length - 1; i >= 0; i -= 1) {
    const produto = Number(campo[i]) * peso;
    soma += produto > 9 ? Math.floor(produto / 10) + (produto % 10) : produto;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
};

const linhaBancaria47Valida = (linha: string) =>
  linha.length === 47 &&
  calcularDvModulo10(linha.slice(0, 9)) === Number(linha[9]) &&
  calcularDvModulo10(linha.slice(10, 20)) === Number(linha[20]) &&
  calcularDvModulo10(linha.slice(21, 31)) === Number(linha[31]);

const calcularDvCodigoBarras = (codigoSemDv: string) => {
  let soma = 0;
  let peso = 2;
  for (let i = codigoSemDv.length - 1; i >= 0; i -= 1) {
    soma += Number(codigoSemDv[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resultado = 11 - (soma % 11);
  return resultado === 0 || resultado === 10 || resultado === 11
    ? 1
    : resultado;
};

const codigoBarras44Valido = (codigo: string) => {
  if (codigo.length !== 44 || codigo.startsWith("8")) return false;
  const semDv = `${codigo.slice(0, 4)}${codigo.slice(5)}`;
  return calcularDvCodigoBarras(semDv) === Number(codigo[4]);
};

const codigoBarrasParaLinhaDigitavel = (codigo: string) => {
  if (!codigoBarras44Valido(codigo)) return "";
  const campoLivre = codigo.slice(19, 44);
  const campo1Base = `${codigo.slice(0, 4)}${campoLivre.slice(0, 5)}`;
  const campo2Base = campoLivre.slice(5, 15);
  const campo3Base = campoLivre.slice(15, 25);
  return `${campo1Base}${calcularDvModulo10(campo1Base)}${campo2Base}${calcularDvModulo10(campo2Base)}${campo3Base}${calcularDvModulo10(campo3Base)}${codigo[4]}${codigo.slice(5, 19)}`;
};

const adicionarCandidatoNumerico = (candidatos: Set<string>, trecho: string) => {
  const digitos = trecho.replace(/\D/g, "");
  if ([44, 47, 48].includes(digitos.length)) candidatos.add(digitos);
};

const encontrarLinhaDigitavel = (texto: string) => {
  const candidatos = new Set<string>();
  const linhas = texto
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((linha) => linha.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  for (const linhaTexto of linhas) {
    adicionarCandidatoNumerico(candidatos, linhaTexto);
    for (const bloco of linhaTexto.match(/\d[\d.\-\s]{35,180}\d/g) || []) {
      adicionarCandidatoNumerico(candidatos, bloco);
    }
  }

  // Alguns PDFs quebram a linha digitável em vários itens/linhas curtas.
  const textoLinear = texto.replace(/\s+/g, " ");
  for (const bloco of textoLinear.match(/\d[\d.\-\s]{35,180}\d/g) || []) {
    const digitos = bloco.replace(/\D/g, "");
    if ([44, 47, 48].includes(digitos.length)) {
      candidatos.add(digitos);
      continue;
    }
    // Quando o bloco engole números vizinhos, tenta janelas plausíveis.
    if (digitos.length > 47 && digitos.length <= 70) {
      for (let i = 0; i <= digitos.length - 47; i += 1) {
        const janela = digitos.slice(i, i + 47);
        if (linhaBancaria47Valida(janela)) candidatos.add(janela);
      }
    }
  }

  for (const item of texto.match(/\d{44,48}/g) || []) {
    adicionarCandidatoNumerico(candidatos, item);
  }

  const lista = [...candidatos];
  const linha47 = lista.find((item) => linhaBancaria47Valida(item));
  if (linha47) return linha47;

  const codigo44 = lista.find((item) => codigoBarras44Valido(item));
  if (codigo44) return codigoBarrasParaLinhaDigitavel(codigo44) || codigo44;

  // Arrecadação/concessionárias usam normalmente 48 dígitos iniciando em 8.
  return lista.find((item) => item.length === 48 && item.startsWith("8")) || "";
};

const vencimentoPeloFator = (fatorTexto: string) => {
  const fator = Number(fatorTexto);
  if (!Number.isInteger(fator) || fator < 1000) return "";

  // Novo ciclo FEBRABAN: fator 1000 = 22/02/2025.
  const baseNovoCiclo = Date.UTC(2022, 4, 29);
  const timestamp = baseNovoCiclo + fator * 24 * 60 * 60 * 1000;
  const inicioNovoCiclo = Date.UTC(2025, 1, 22);
  const limiteFuturo = Date.now() + 8 * 365.25 * 24 * 60 * 60 * 1000;
  if (timestamp < inicioNovoCiclo || timestamp > limiteFuturo) return "";
  return new Date(timestamp).toISOString().slice(0, 10);
};

const extrairDadosDaLinha = (linha: string) => {
  if (linhaBancaria47Valida(linha)) {
    const centavos = Number(linha.slice(37, 47));
    return {
      valor: centavos > 0 ? centavos / 100 : 0,
      vencimento: vencimentoPeloFator(linha.slice(33, 37)),
      linhaValida: true,
    };
  }

  if (codigoBarras44Valido(linha)) {
    const centavos = Number(linha.slice(9, 19));
    return {
      valor: centavos > 0 ? centavos / 100 : 0,
      vencimento: vencimentoPeloFator(linha.slice(5, 9)),
      linhaValida: true,
    };
  }

  return { valor: 0, vencimento: "", linhaValida: false };
};

const linhasDoTextoBoleto = (texto: string) =>
  texto
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((linha) => linha.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

const procurarDepoisDoRotulo = (
  texto: string,
  rotulo: RegExp,
  extrator: (trecho: string) => string,
) => {
  const linhas = linhasDoTextoBoleto(texto);
  for (let i = 0; i < linhas.length; i += 1) {
    const correspondencia = linhas[i].match(rotulo);
    if (!correspondencia || correspondencia.index === undefined) continue;

    const depoisDoRotulo = linhas[i].slice(
      correspondencia.index + correspondencia[0].length,
    );
    const mesmoCampo = extrator(depoisDoRotulo);
    if (mesmoCampo) return mesmoCampo;

    // Em boletos, o valor do campo pode ser um item separado logo abaixo.
    for (let deslocamento = 1; deslocamento <= 2; deslocamento += 1) {
      const proxima = linhas[i + deslocamento];
      if (!proxima) break;
      const encontrado = extrator(proxima);
      if (encontrado) return encontrado;
      // Se já começou outro rótulo de boleto, evita capturar um campo vizinho.
      if (/^(?:agência|cedente|beneficiário|pagador|nosso número|data|valor|vencimento|carteira|espécie|quantidade)/i.test(proxima)) {
        break;
      }
    }
  }
  return "";
};

const extrairValorMonetario = (trecho: string) => {
  const valores = [
    ...trecho.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,9},\d{2})/g),
  ];
  for (const item of valores) {
    const valor = item[1];
    if (valorTextoParaNumero(valor) > 0) return valor;
  }
  return "";
};

const extrairValorDoTexto = (texto: string) => {
  const rotulos = [
    /valor\s+do\s+documento/i,
    /valor\s+cobrado/i,
    /valor\s+do\s+boleto/i,
    /valor\s+a\s+pagar/i,
    /total\s+a\s+pagar/i,
  ];

  for (const rotulo of rotulos) {
    const valor = procurarDepoisDoRotulo(texto, rotulo, extrairValorMonetario);
    if (valor) return valor;
  }

  // Fallback para PDFs que perderam as quebras de linha durante a extração.
  const textoLinear = texto.replace(/\s+/g, " ");
  for (const rotulo of rotulos) {
    const origem = rotulo.source;
    const achado = textoLinear.match(
      new RegExp(`${origem}[^0-9]{0,45}(?:R\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d{1,9},\\d{2})`, "i"),
    )?.[1];
    if (achado && valorTextoParaNumero(achado) > 0) return achado;
  }
  return "";
};

const extrairDataBr = (trecho: string) => {
  const datas = trecho.match(/\b(\d{2}\/\d{2}\/\d{4})\b/g) || [];
  for (const data of datas) {
    const iso = dataBrParaIso(data);
    if (iso) return iso;
  }
  return "";
};

const extrairVencimentoDoTexto = (texto: string) => {
  const data = procurarDepoisDoRotulo(
    texto,
    /(?:data\s+de\s+)?vencimento|venc\.?/i,
    extrairDataBr,
  );
  if (data) return data;

  const textoLinear = texto.replace(/\s+/g, " ");
  const trecho = textoLinear.match(
    /(?:(?:data\s+de\s+)?vencimento|venc\.?).{0,70}?(\d{2}\/\d{2}\/\d{4})/i,
  )?.[1];
  return trecho ? dataBrParaIso(trecho) : "";
};

const extrairCamposBoletoLocalmente = (texto: string): ResultadoLeituraLocal => {
  const linha = encontrarLinhaDigitavel(texto);
  const dadosLinha = extrairDadosDaLinha(linha);
  const valorTexto = extrairValorDoTexto(texto);
  const vencimentoTexto = extrairVencimentoDoTexto(texto);
  const alertas: string[] = [];

  const valorDaLinha = dadosLinha.valor;
  const valorDoTexto = valorTexto ? valorTextoParaNumero(valorTexto) : 0;
  if (
    valorDaLinha > 0 &&
    valorDoTexto > 0 &&
    Math.abs(valorDaLinha - valorDoTexto) > 0.009
  ) {
    alertas.push(
      "O valor impresso diverge do valor codificado na linha digitável; foi usado o valor da linha validada.",
    );
  }

  if (
    dadosLinha.vencimento &&
    vencimentoTexto &&
    dadosLinha.vencimento !== vencimentoTexto
  ) {
    alertas.push(
      "O vencimento impresso diverge do fator da linha digitável; foi usada a data impressa no campo Vencimento.",
    );
  }

  const valorFinal =
    valorDaLinha > 0
      ? formatarValorBoleto(valorDaLinha)
      : valorTexto || "";
  const vencimentoFinal = vencimentoTexto || dadosLinha.vencimento || "";

  return {
    dados: {
      valor: valorFinal,
      vencimento: vencimentoFinal,
      linhaDigitavel: linha,
    },
    // Também exige a linha digitável: se ela faltar, a IA ainda pode completar.
    completo: Boolean(valorFinal && vencimentoFinal && linha),
    linhaValida: dadosLinha.linhaValida || Boolean(linha.length === 48 && linha.startsWith("8")),
    valorConfiavel: Boolean(valorDaLinha > 0 || valorTexto),
    vencimentoConfiavel: Boolean(vencimentoTexto || dadosLinha.vencimento),
    alertas,
  };
};

const comTimeout = async <T,>(promessa: Promise<T>, ms: number): Promise<T> => {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promessa,
      new Promise<never>((_, rejeitar) => {
        temporizador = setTimeout(
          () => rejeitar(new Error("Tempo limite da leitura por IA excedido.")),
          ms,
        );
      }),
    ]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
};

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
    registrarBoletoAnexado,
    emitirDistratoTermo,
    conferirDocumentosProtesto,
    encaminharParaProtesto,
    efetivarProtesto,
    encaminharParaAjuizamento,
    adicionarDocumento,
    reabrirDistrato,
    atualizarDadosCadastrais,
    excluirDistrato,
  } = useDistratos();

  const distrato = distratos.find((d) => d.id === distratoId);

  // Aba selecionada dentro do processo
  const [abaInterna, setAbaInterna] = useState<
    "auditorias" | "financeiro" | "juridico" | "documentos" | "historico"
  >("auditorias");
  const arquivoInput = useRef<HTMLInputElement>(null);
  const arquivoContextualInput = useRef<HTMLInputElement>(null);
  const comprovantePagamentoInput = useRef<HTMLInputElement>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [baixandoPasta, setBaixandoPasta] = useState(false);
  const [mensagemArquivo, setMensagemArquivo] = useState<string | null>(null);
  const [categoriaDocumento, setCategoriaDocumento] = useState(
    "Contrato de aluguel",
  );
  const [descricaoDocumento, setDescricaoDocumento] = useState("");
  const [modalAnexo, setModalAnexo] = useState<null | {
    origem: "Cobrança e pagamentos" | "Jurídico";
    categoria: string;
  }>(null);
  const [descricaoAnexoContextual, setDescricaoAnexoContextual] = useState("");
  const [arquivoBoleto, setArquivoBoleto] = useState<File | null>(null);
  const [lendoBoleto, setLendoBoleto] = useState(false);
  const [resultadoLeitura, setResultadoLeitura] = useState("");
  const [dadosBoleto, setDadosBoleto] = useState({
    valor: "",
    vencimento: "",
    linhaDigitavel: "",
  });
  const [modalEditarCadastro, setModalEditarCadastro] = useState(false);
  const [modalConfirmarExclusao, setModalConfirmarExclusao] = useState(false);
  const [excluindoDistrato, setExcluindoDistrato] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [formCadastro, setFormCadastro] = useState({
    agregadoNome: "",
    placaCavalo: "",
    placaCarreta: "",
    tipoDistrato: "Cavalo e Carreta" as Distrato["tipoDistrato"],
    gridOperacao: "",
    gridOutro: "",
    segmento: "Aço",
    segmentoOutro: "",
    debitoAluguel: 0,
    statusTermoAgregacao: "Em Encerramento" as Distrato["statusTermoAgregacao"],
  });

  const anexarArquivo = async (
    arquivo?: File,
    metadados?: {
      categoria: string;
      descricao: string;
      origem: string;
      boleto?: { valor: number; vencimento: string; linhaDigitavel?: string };
    },
  ) => {
    if (!arquivo || !distrato) return;
    setMensagemArquivo(null);
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(arquivo.type) ||
      arquivo.size > 10 * 1024 * 1024
    ) {
      setMensagemArquivo("Escolha um PDF, JPG ou PNG de até 10 MB.");
      return;
    }
    setEnviandoArquivo(true);
    try {
      const nomeSeguro = arquivo.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(-120);
      const caminho = `${distrato.id}/${crypto.randomUUID()}-${nomeSeguro}`;
      const { error } = await supabase.storage
        .from("documentos-distratos")
        .upload(caminho, arquivo, {
          contentType: arquivo.type,
          upsert: false,
        });
      if (error) throw error;
      adicionarDocumento(distrato.id, {
        nome: arquivo.name,
        tipo: arquivo.type,
        tamanhoKb: Math.ceil(arquivo.size / 1024),
        categoria: metadados?.categoria || categoriaDocumento,
        descricao: metadados?.descricao || descricaoDocumento,
        origem: (metadados?.origem || "Documentos gerais") as
          "Documentos gerais" | "Cobrança e pagamentos" | "Jurídico",
        url: caminho,
      });
      if (metadados?.boleto) {
        registrarBoletoAnexado(distrato.id, {
          dataVencimento: metadados.boleto.vencimento,
          valor: metadados.boleto.valor,
          linhaDigitavel: metadados.boleto.linhaDigitavel,
          arquivoNome: arquivo.name,
          arquivoUrl: caminho,
        });
      }
      setMensagemArquivo(
        "Arquivo enviado. Aguarde a confirmação de gravação do distrato na faixa superior.",
      );
      if (metadados) {
        setModalAnexo(null);
        setDescricaoAnexoContextual("");
        setArquivoBoleto(null);
      }
    } catch (error) {
      setMensagemArquivo(
        `Não foi possível enviar o arquivo: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    } finally {
      setEnviandoArquivo(false);
      if (arquivoInput.current) arquivoInput.current.value = "";
      if (arquivoContextualInput.current)
        arquivoContextualInput.current.value = "";
    }
  };

  const abrirAnexoContextual = (
    origem: "Cobrança e pagamentos" | "Jurídico",
    categoria: string,
  ) => {
    setMensagemArquivo(null);
    setDescricaoAnexoContextual("");
    setArquivoBoleto(null);
    setResultadoLeitura("");
    setDadosBoleto({ valor: "", vencimento: "", linhaDigitavel: "" });
    setModalAnexo({ origem, categoria });
  };

  const extrairTextoPdf = async (arquivo: File) => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() })
      .promise;
    const paginas: string[] = [];

    for (let numero = 1; numero <= Math.min(pdf.numPages, 3); numero += 1) {
      const pagina = await pdf.getPage(numero);
      const conteudo = await pagina.getTextContent();
      const itens = conteudo.items
        .filter((item) => "str" in item && String(item.str).trim())
        .map((item) => {
          const textoItem = item as {
            str: string;
            transform?: number[];
          };
          return {
            texto: textoItem.str.trim(),
            x: Number(textoItem.transform?.[4] || 0),
            y: Number(textoItem.transform?.[5] || 0),
          };
        })
        .sort((a, b) => b.y - a.y);

      const grupos: Array<{
        y: number;
        itens: Array<{ texto: string; x: number }>;
      }> = [];
      for (const item of itens) {
        const ultimo = grupos[grupos.length - 1];
        if (!ultimo || Math.abs(ultimo.y - item.y) > 2.5) {
          grupos.push({ y: item.y, itens: [{ texto: item.texto, x: item.x }] });
        } else {
          ultimo.itens.push({ texto: item.texto, x: item.x });
        }
      }

      const linhas = grupos
        .map((grupo) =>
          grupo.itens
            .sort((a, b) => a.x - b.x)
            .map((item) => item.texto)
            .join(" ")
            .replace(/[ \t]+/g, " ")
            .trim(),
        )
        .filter(Boolean);

      // Mantém o layout em linhas e acrescenta a ordem nativa como fallback.
      const sequencial = conteudo.items
        .map((item) => ("str" in item ? String(item.str).trim() : ""))
        .filter(Boolean)
        .join(" ");
      paginas.push(`${linhas.join("\n")}\n${sequencial}`);
    }

    return { texto: paginas.join("\n"), pdf };
  };

  const arquivoParaBase64 = (arquivo: File) =>
    new Promise<string>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result).split(",")[1] || "");
      leitor.onerror = () => reject(new Error("Falha ao ler o arquivo."));
      leitor.readAsDataURL(arquivo);
    });

  const renderizarPrimeiraPagina = async (
    arquivo: File,
    pdfAtual: Awaited<ReturnType<typeof extrairTextoPdf>>["pdf"] | null,
  ) => {
    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Canvas indisponível.");

    if (arquivo.type === "application/pdf") {
      let pdf = pdfAtual;
      if (!pdf) {
        const leitura = await extrairTextoPdf(arquivo);
        pdf = leitura.pdf;
      }
      const pagina = await pdf.getPage(1);
      const viewport = pagina.getViewport({ scale: 2.2 });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
      return canvas;
    }

    const bitmap = await createImageBitmap(arquivo);
    const limite = 2400;
    const escala = Math.min(1, limite / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  };

  const tentarLerCodigoDeBarras = async (canvas: HTMLCanvasElement) => {
    try {
      const Janela = window as unknown as {
        BarcodeDetector?: new (opcoes?: { formats?: string[] }) => {
          detect: (origem: HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
        };
      };
      if (!Janela.BarcodeDetector) return "";
      const detector = new Janela.BarcodeDetector({ formats: ["itf"] });
      const resultados = await detector.detect(canvas);
      for (const resultado of resultados) {
        const digitos = String(resultado.rawValue || "").replace(/\D/g, "");
        if (codigoBarras44Valido(digitos)) return digitos;
        if (linhaBancaria47Valida(digitos)) return digitos;
      }
    } catch {
      // Nem todo navegador oferece BarcodeDetector/ITF; segue para OCR/IA.
    }
    return "";
  };

  const normalizarLinhaDaIa = (valor: unknown) => {
    const linha = String(valor || "").replace(/\D/g, "");
    if (linhaBancaria47Valida(linha)) return linha;
    if (codigoBarras44Valido(linha)) {
      return codigoBarrasParaLinhaDigitavel(linha) || linha;
    }
    if (linha.length === 48 && linha.startsWith("8")) return linha;
    return "";
  };

  const lerArquivoBoleto = async (arquivo: File) => {
    setArquivoBoleto(arquivo);
    setLendoBoleto(true);
    setDadosBoleto({ valor: "", vencimento: "", linhaDigitavel: "" });
    setResultadoLeitura("Lendo os dados do boleto…");

    let texto = "";
    let pdfLido: Awaited<ReturnType<typeof extrairTextoPdf>>["pdf"] | null =
      null;

    try {
      if (arquivo.type === "application/pdf") {
        try {
          const leituraPdf = await extrairTextoPdf(arquivo);
          texto = leituraPdf.texto;
          pdfLido = leituraPdf.pdf;
        } catch {
          texto = "";
        }
      }

      const local = extrairCamposBoletoLocalmente(texto);
      setDadosBoleto(local.dados);

      if (local.completo) {
        setResultadoLeitura(
          `Leitura local concluída. Valor, vencimento e linha digitável foram identificados.${
            local.alertas.length ? ` Atenção: ${local.alertas.join(" • ")}` : ""
          }`,
        );
        return;
      }

      setResultadoLeitura(
        "Encontrei parte dos dados. Conferindo visualmente o boleto pela IA…",
      );

      let dadosCombinados: DadosBoletoLeitura = { ...local.dados };
      let mensagemIa = "";
      try {
        const enviarVisual = arquivo.size <= 8 * 1024 * 1024;
        let body: Record<string, unknown>;

        if (enviarVisual) {
          // Envia SOMENTE o arquivo visual. Isso funciona tanto com a função antiga
          // quanto com a nova; a função antiga ignorava o PDF quando textoExtraido
          // era enviado junto, que foi o motivo da regressão anterior.
          body = {
            arquivoBase64: await arquivoParaBase64(arquivo),
            mimeType: arquivo.type,
          };
        } else {
          body = {
            textoExtraido: texto.trim() || undefined,
            mimeType: "text/plain",
          };
        }

        const { data, error } = await comTimeout(
          supabase.functions.invoke("ler-boleto", { body }),
          15000,
        );
        if (error || data?.erro) throw new Error(data?.erro || error?.message);

        const valorIa =
          typeof data?.valor === "number" &&
          Number.isFinite(data.valor) &&
          data.valor > 0
            ? formatarValorBoleto(data.valor)
            : "";
        const vencimentoIa = /^\d{4}-\d{2}-\d{2}$/.test(
          String(data?.vencimento || ""),
        )
          ? String(data.vencimento)
          : "";
        const linhaIa = normalizarLinhaDaIa(data?.linhaDigitavel);

        const alertas = [...local.alertas];
        if (
          local.valorConfiavel &&
          valorIa &&
          Math.abs(
            valorTextoParaNumero(local.dados.valor) - valorTextoParaNumero(valorIa),
          ) > 0.009
        ) {
          alertas.push(
            "A IA encontrou outro valor, mas mantive o valor validado localmente.",
          );
        }
        if (
          local.vencimentoConfiavel &&
          vencimentoIa &&
          local.dados.vencimento !== vencimentoIa
        ) {
          alertas.push(
            "A IA encontrou outro vencimento, mas mantive a data identificada no campo Vencimento.",
          );
        }

        dadosCombinados = {
          valor: local.valorConfiavel ? local.dados.valor : valorIa,
          vencimento: local.vencimentoConfiavel
            ? local.dados.vencimento
            : vencimentoIa,
          linhaDigitavel: local.linhaValida
            ? local.dados.linhaDigitavel
            : linhaIa || local.dados.linhaDigitavel,
        };
        setDadosBoleto(dadosCombinados);

        const detalhes = [data?.banco, data?.beneficiario, data?.pagador]
          .filter(Boolean)
          .join(" • ");
        const alertasIa = Array.isArray(data?.alertas)
          ? data.alertas.filter(Boolean)
          : [];
        const todosAlertas = [...alertas, ...alertasIa];
        mensagemIa = `Leitura concluída. Confira antes de confirmar.${
          detalhes ? ` ${detalhes}.` : ""
        }${
          todosAlertas.length ? ` Atenção: ${todosAlertas.join(" • ")}` : ""
        }`;
        setResultadoLeitura(mensagemIa);

        if (
          dadosCombinados.valor &&
          dadosCombinados.vencimento &&
          dadosCombinados.linhaDigitavel
        ) {
          return;
        }
      } catch {
        setResultadoLeitura(
          "A IA não concluiu em até 15 segundos. Tentando uma leitura visual local…",
        );
      }

      // Se ainda faltou algo, tenta o código de barras e depois OCR da primeira página.
      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = await renderizarPrimeiraPagina(arquivo, pdfLido);
        const codigo = await tentarLerCodigoDeBarras(canvas);
        if (codigo) {
          const peloCodigo = extrairCamposBoletoLocalmente(codigo);
          dadosCombinados = {
            valor: dadosCombinados.valor || peloCodigo.dados.valor,
            vencimento: dadosCombinados.vencimento || peloCodigo.dados.vencimento,
            linhaDigitavel:
              dadosCombinados.linhaDigitavel || peloCodigo.dados.linhaDigitavel,
          };
          setDadosBoleto(dadosCombinados);
          if (
            dadosCombinados.valor &&
            dadosCombinados.vencimento &&
            dadosCombinados.linhaDigitavel
          ) {
            setResultadoLeitura(
              "Leitura concluída pelo código de barras. Confira antes de confirmar.",
            );
            return;
          }
        }
      } catch {
        canvas = null;
      }

      try {
        if (!canvas) canvas = await renderizarPrimeiraPagina(arquivo, pdfLido);
        setResultadoLeitura("Fazendo a última conferência visual do boleto…");
        const { recognize } = await import("tesseract.js");
        const resultado = await comTimeout(recognize(canvas, "por"), 15000);
        const textoOcr = resultado.data.text;
        const localOcr = extrairCamposBoletoLocalmente(textoOcr);

        // O OCR só preenche o que ainda está vazio; não sobrescreve dados já validados.
        dadosCombinados = {
          valor: dadosCombinados.valor || localOcr.dados.valor,
          vencimento: dadosCombinados.vencimento || localOcr.dados.vencimento,
          linhaDigitavel:
            dadosCombinados.linhaDigitavel || localOcr.dados.linhaDigitavel,
        };
        setDadosBoleto(dadosCombinados);

        const completo = Boolean(
          dadosCombinados.valor &&
            dadosCombinados.vencimento &&
            dadosCombinados.linhaDigitavel,
        );
        setResultadoLeitura(
          completo
            ? `Leitura concluída. Confira os dados antes de confirmar.${
                localOcr.alertas.length
                  ? ` Atenção: ${localOcr.alertas.join(" • ")}`
                  : ""
              }`
            : mensagemIa ||
                "Não foi possível identificar todos os campos com segurança. Confira e complete manualmente.",
        );
      } catch {
        setResultadoLeitura(
          mensagemIa ||
            "Não foi possível identificar todos os campos com segurança. Confira e complete manualmente.",
        );
      }
    } catch {
      setResultadoLeitura(
        "Não foi possível ler automaticamente. Preencha os dados manualmente.",
      );
    } finally {
      setLendoBoleto(false);
    }
  };

  const baixarArquivo = async (nome: string, caminho?: string) => {
    if (!caminho) {
      setMensagemArquivo(
        "Este registro antigo contém apenas o nome do arquivo. Nenhum documento foi enviado.",
      );
      return;
    }
    setMensagemArquivo(null);
    const { data, error } = await supabase.storage
      .from("documentos-distratos")
      .download(caminho);
    if (error || !data) {
      setMensagemArquivo(
        `Não foi possível baixar o arquivo: ${error?.message || "arquivo indisponível"}`,
      );
      return;
    }
    const endereco = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = endereco;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
  };

  const baixarPastaCompleta = async () => {
    setBaixandoPasta(true);
    setMensagemArquivo("Preparando a pasta completa do distrato…");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const limparNome = (valor: string) =>
        valor
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[<>:"/\\|?*]/g, "-")
          .trim() || "Outros";
      const usados = new Map<string, number>();
      const indisponiveis: string[] = [];
      const csv = (linhas: Array<Array<string | number>>) =>
        "\uFEFF" + linhas
          .map((linha) =>
            linha
              .map((celula) => `"${String(celula ?? "").replace(/"/g, '""')}"`)
              .join(";"),
          )
          .join("\r\n");

      zip.file("01_Dados/distrato.json", JSON.stringify(distrato, null, 2));
      zip.file(
        "01_Dados/resumo-financeiro.csv",
        csv([
          ["Distrato", "Agregado", "Código", "Dívida total", "Total pago", "Saldo devedor"],
          [
            distrato.id,
            distrato.agregadoNome,
            distrato.agregadoCodigo,
            calcularDividaTotal(distrato).toFixed(2),
            calcularTotalPago(distrato).toFixed(2),
            calcularSaldoRestante(distrato).toFixed(2),
          ],
        ]),
      );
      zip.file(
        "02_Pagamentos/pagamentos.csv",
        csv([
          ["Data", "Categoria", "Dívida vinculada", "Forma", "Valor", "Status", "Comprovante", "Observação", "Registrado por"],
          ...distrato.pagamentos.map((pagamento) => [
            pagamento.data,
            pagamento.categoria || "Outros",
            pagamento.dividaDescricao || "Pagamento antigo sem vínculo individual",
            pagamento.formaPagamento,
            pagamento.valor.toFixed(2),
            pagamento.cancelado ? "Cancelado" : "Confirmado",
            pagamento.comprovanteNome || "",
            pagamento.observacao || "",
            pagamento.usuarioNome,
          ]),
        ]),
      );
      zip.file(
        "03_Auditorias/auditorias.csv",
        csv([
          ["Auditoria", "Status", "Data", "Documento/NF", "Valor", "Observações", "Responsável"],
          ...distrato.verificacoes.flatMap((verificacao) => {
            const lancamentos = verificacao.lancamentos || [];
            return lancamentos.length
              ? lancamentos.map((lancamento) => [
                  verificacao.titulo,
                  verificacao.status,
                  lancamento.data,
                  lancamento.numeroDocumento || "",
                  lancamento.valor.toFixed(2),
                  lancamento.observacoes || "",
                  lancamento.usuarioNome,
                ])
              : [[
                  verificacao.titulo,
                  verificacao.status,
                  verificacao.dataAuditoria || "",
                  verificacao.abastecimentoNumeroNF || verificacao.multasAutos || "",
                  Number(verificacao.valor || 0).toFixed(2),
                  verificacao.observacoes || "",
                  verificacao.responsavelNome || "",
                ]];
          }),
        ]),
      );

      const urlsJaListadas = new Set(distrato.documentos.map((doc) => doc.url).filter(Boolean));
      const arquivosExtras: Anexo[] = [
        ...distrato.boletos
          .filter((boleto) => boleto.arquivoUrl && !urlsJaListadas.has(boleto.arquivoUrl))
          .map((boleto) => ({
            id: boleto.id,
            nome: boleto.arquivoNome || `${boleto.numeroDocumento || boleto.id}.pdf`,
            tipo: "application/pdf",
            url: boleto.arquivoUrl,
            tamanhoKb: 0,
            dataUpload: boleto.dataEmissao,
            usuarioId: "",
            usuarioNome: "",
            categoria: "Boletos",
          })),
        ...distrato.pagamentos
          .filter((pagamento) => pagamento.comprovanteUrl && !urlsJaListadas.has(pagamento.comprovanteUrl))
          .map((pagamento) => ({
            id: pagamento.id,
            nome: pagamento.comprovanteNome || `comprovante-${pagamento.id}`,
            tipo: "application/octet-stream",
            url: pagamento.comprovanteUrl,
            tamanhoKb: 0,
            dataUpload: pagamento.data,
            usuarioId: pagamento.usuarioId,
            usuarioNome: pagamento.usuarioNome,
            categoria: "Comprovantes de pagamento",
          })),
      ];

      for (const doc of [...distrato.documentos, ...arquivosExtras]) {
        if (!doc.url) {
          indisponiveis.push(`${doc.nome} (registro antigo sem arquivo)`);
          continue;
        }
        const { data, error } = await supabase.storage
          .from("documentos-distratos")
          .download(doc.url);
        if (error || !data) {
          indisponiveis.push(`${doc.nome} (falha ao baixar)`);
          continue;
        }
        const pasta = limparNome(doc.categoria || "Outros documentos");
        const chave = `${pasta}/${doc.nome}`;
        const repeticao = usados.get(chave) || 0;
        usados.set(chave, repeticao + 1);
        const ponto = doc.nome.lastIndexOf(".");
        const nomeFinal =
          repeticao === 0
            ? doc.nome
            : ponto > 0
              ? `${doc.nome.slice(0, ponto)} (${repeticao + 1})${doc.nome.slice(ponto)}`
              : `${doc.nome} (${repeticao + 1})`;
        zip.folder(`04_Documentos/${pasta}`)?.file(nomeFinal, data);
      }

      const resumo = csv([
        ["Campo", "Valor", "Detalhes"],
        ["Distrato", distrato.id, ""],
        ["Agregado", distrato.agregadoNome, ""],
        ["Código", distrato.agregadoCodigo, ""],
        ["Placa do cavalo", distrato.placaCavalo || "", ""],
        ["Placa da carreta", distrato.placaCarreta || "", ""],
        ["Grid / Operação", distrato.gridOperacao || "", ""],
        ["Status geral", distrato.statusGeral, ""],
        ["Status financeiro", distrato.statusFinanceiro, ""],
        ["Gerado em", new Date().toLocaleString("pt-BR"), ""],
        ["Total de documentos", distrato.documentos.length + arquivosExtras.length, ""],
        ["Dívida total", calcularDividaTotal(distrato).toFixed(2), "R$"],
        ["Total pago", calcularTotalPago(distrato).toFixed(2), "R$"],
        ["Saldo devedor", calcularSaldoRestante(distrato).toFixed(2), "R$"],
        ["", "", ""],
        ["Documentos", "Arquivo", "Descrição"],
        ...distrato.documentos.map((doc) => [
          doc.categoria || "Documento geral",
          doc.nome,
          doc.descricao || "Sem descrição",
        ]),
        ...(indisponiveis.length
          ? [
              ["", "", ""],
              ["Arquivos indisponíveis", "Motivo", ""],
              ...indisponiveis.map((arquivo) => [arquivo, "Arquivo não incluído no ZIP", ""]),
            ]
          : []),
      ]);
      zip.file("RESUMO_DO_DISTRATO.csv", resumo);

      const arquivoZip = await zip.generateAsync({ type: "blob" });
      const endereco = URL.createObjectURL(arquivoZip);
      const link = document.createElement("a");
      link.href = endereco;
      link.download = `${limparNome(distrato.id)} - ${limparNome(distrato.agregadoNome)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
      setMensagemArquivo(
        indisponiveis.length
          ? `Pasta criada. ${indisponiveis.length} registro(s) antigo(s) não possuía(m) arquivo disponível.`
          : "Pasta completa baixada com sucesso.",
      );
    } catch (error) {
      setMensagemArquivo(
        `Não foi possível criar a pasta: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    } finally {
      setBaixandoPasta(false);
    }
  };

  // Estado para edição rápida de verificação
  const [editandoVerifId, setEditandoVerifId] = useState<string | null>(null);
  const [formVerif, setFormVerif] = useState<Partial<Verificacao>>({});
  const [arquivosAuditoria, setArquivosAuditoria] = useState<File[]>([]);
  const [lancamentosPendentes, setLancamentosPendentes] = useState<
    Array<{ form: Partial<Verificacao>; arquivos: File[] }>
  >([]);
  const [salvandoAuditoria, setSalvandoAuditoria] = useState(false);
  const [erroAuditoria, setErroAuditoria] = useState("");
  const [detalheLancamento, setDetalheLancamento] = useState<null | {
    verificacaoId: string;
    lancamento: LancamentoVerificacao;
    editando: boolean;
  }>(null);

  // Estado para novo pagamento
  const [modalNovoPagamento, setModalNovoPagamento] = useState(false);
  const [comprovantePagamento, setComprovantePagamento] = useState<File | null>(
    null,
  );
  const [enviandoPagamento, setEnviandoPagamento] = useState(false);
  const [erroPagamento, setErroPagamento] = useState("");
  const [formPagamento, setFormPagamento] = useState({
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    formaPagamento: "PIX" as Pagamento["formaPagamento"],
    categoria: "Aluguel" as NonNullable<Pagamento["categoria"]>,
    dividaId: "",
    observacao: "",
    comprovanteNome: "",
  });

  // Estado para protesto
  const [modalProtesto, setModalProtesto] = useState(false);
  const [formProtesto, setFormProtesto] = useState({
    cartorio: "",
    custas: "",
    dataEnvio: "",
    comprovanteId: "",
  });
  const [modalEfetivacaoProtesto, setModalEfetivacaoProtesto] = useState(false);
  const [formEfetivacaoProtesto, setFormEfetivacaoProtesto] = useState({
    data: "",
    comprovanteId: "",
  });

  // Estado para ajuizamento
  const [modalAjuizamento, setModalAjuizamento] = useState(false);
  const [formAjuizamento, setFormAjuizamento] = useState({
    numeroProcesso: "",
    varaComarca: "",
    valorAcao: "",
    observacoes: "",
    comprovanteId: "",
  });

  // Estado para reabertura de processo
  const [modalReabertura, setModalReabertura] = useState(false);
  const [justificativaReabertura, setJustificativaReabertura] = useState("");

  if (!distrato) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-stone-200">
        <p className="text-stone-600 font-semibold">
          Processo de distrato não encontrado.
        </p>
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
  const categoriaPorTipo: Record<string, NonNullable<Pagamento["categoria"]>> = {
    manutencao: "Manutenção",
    sinistro: "Manutenção",
    perda_carga: "Outros",
    multas: "Multa",
    abastecimento: "Abastecimento",
    estadia: "Outros",
    camera_rastreador: "Câmera e Rastreador",
    estacionamento: "Estacionamento",
    pneus: "Pneus",
    antt: "Outros",
    suprimentos: "Outros",
  };
  const pagamentosAtivos = distrato.pagamentos.filter((p) => !p.cancelado);
  const totalPagoNaDivida = (dividaId: string) =>
    pagamentosAtivos
      .filter((p) => p.dividaId === dividaId)
      .reduce((soma, p) => soma + Number(p.valor || 0), 0);
  const dividasParaPagamento = [
    ...(distrato.debitoAluguel > 0
      ? [{
          id: "aluguel-contratual",
          categoria: "Aluguel" as const,
          descricao: "Débito inicial de aluguel de equipamento / carreta",
          valor: Number(distrato.debitoAluguel),
        }]
      : []),
    ...distrato.verificacoes.flatMap((verificacao) => {
      const categoria = categoriaPorTipo[verificacao.tipo] || "Outros";
      if (verificacao.lancamentos?.length) {
        return verificacao.lancamentos
          .filter((lancamento) => Number(lancamento.valor) > 0)
          .map((lancamento) => ({
            id: lancamento.id,
            categoria,
            descricao: lancamento.observacoes
              ? `${verificacao.titulo} — ${lancamento.observacoes}`
              : `Lançamento de ${verificacao.titulo}`,
            valor: Number(lancamento.valor),
            verificacaoId: verificacao.id,
            lancamentoId: lancamento.id,
          }));
      }
      return Number(verificacao.valor) > 0
        ? [{
            id: `verificacao-${verificacao.id}`,
            categoria,
            descricao: verificacao.titulo,
            valor: Number(verificacao.valor),
            verificacaoId: verificacao.id,
          }]
        : [];
    }),
  ].map((divida) => {
    const pago = totalPagoNaDivida(divida.id);
    return { ...divida, pago, saldo: Math.max(0, divida.valor - pago) };
  });
  const dividasEmAberto = dividasParaPagamento.filter((divida) => divida.saldo > 0.009);
  const dividaSelecionada = dividasParaPagamento.find(
    (divida) => divida.id === formPagamento.dividaId,
  );
  const situacaoDivida = (dividaId: string, valor: number) => {
    const pago = totalPagoNaDivida(dividaId);
    if (pago >= valor - 0.009) return { texto: "Quitado", classe: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    if (pago > 0) return { texto: "Parcialmente pago", classe: "bg-amber-100 text-amber-800 border-amber-200" };
    return { texto: "Em aberto", classe: "bg-rose-50 text-rose-700 border-rose-200" };
  };
  const departamentosUsuario =
    usuarioAtual.departamentos ||
    (usuarioAtual.departamento ? [usuarioAtual.departamento] : []);
  const supervisor = usuarioAtual.perfil === "admin";
  const areaPorTipo: Record<string, string> = {
    manutencao: "Oficina",
    sinistro: "Oficina",
    perda_carga: "Auditoria",
    multas: "Multa",
    abastecimento: "Abastecimento",
    estadia: "Customer Service",
    camera_rastreador: "Tecnologia Integrada",
    estacionamento: "Estacionamento",
    pneus: "Almoxarifado",
    antt: "Customer Service",
    suprimentos: "Auditoria de Suprimentos",
  };
  const podeEditarVerificacao = (tipo: string) =>
    supervisor || departamentosUsuario.includes(areaPorTipo[tipo]);
  const verificacoesVisiveis = supervisor
    ? distrato.verificacoes
    : distrato.verificacoes.filter((v) => podeEditarVerificacao(v.tipo));
  const podeAcessarFinanceiro =
    supervisor || departamentosUsuario.includes("Financeiro");
  const podeAcessarJuridico =
    supervisor || departamentosUsuario.includes("Jurídico");
  const podeImprimir =
    supervisor || departamentosUsuario.includes("Controladoria e Planejamento");
  const podeEditarCadastro =
    supervisor || departamentosUsuario.includes("Logística");
  const temPerfilJuridico = ["admin", "juridico"].includes(usuarioAtual.perfil);
  const podeRegistrarJuridico = temPerfilJuridico && saldoRestante > 0;
  const comprovantesDisponiveis = distrato.documentos.filter((doc) =>
    Boolean(doc.url),
  );

  const abrirEdicaoCadastro = () => {
    const gridsPadrao = ["Uruguai", "México", "EUA"];
    const segmentosPadrao = ["Aço", "Vegetal", "Graneleiro"];
    setFormCadastro({
      agregadoNome: distrato.agregadoNome,
      placaCavalo: distrato.placaCavalo,
      placaCarreta: distrato.placaCarreta,
      tipoDistrato: distrato.tipoDistrato,
      gridOperacao: gridsPadrao.includes(distrato.gridOperacao)
        ? distrato.gridOperacao
        : "Outro",
      gridOutro: gridsPadrao.includes(distrato.gridOperacao)
        ? ""
        : distrato.gridOperacao,
      segmento: segmentosPadrao.includes(distrato.segmento)
        ? distrato.segmento
        : "Outro",
      segmentoOutro: segmentosPadrao.includes(distrato.segmento)
        ? ""
        : distrato.segmento,
      debitoAluguel: distrato.debitoAluguel || 0,
      statusTermoAgregacao: distrato.statusTermoAgregacao,
    });
    setModalEditarCadastro(true);
  };

  // Manipuladores de Verificação
  const handleIniciarEdicaoVerif = (v: Verificacao) => {
    setEditandoVerifId(v.id);
    setFormVerif({
      ...v,
      valor: 0,
      cameraValor: 0,
      rastreadorValor: 0,
      pneusQuantidade: 0,
      anttStatus: v.anttStatus || "Em observação",
      observacoes: "",
      abastecimentoNumeroNF: "",
      multasAutos: "",
      estacionamentoTag: "",
      responsavelAuditoria: usuarioAtual.nome,
    });
    setArquivosAuditoria([]);
    setLancamentosPendentes([]);
    setErroAuditoria("");
  };

  const valorDoFormulario = (
    verificacao: Verificacao,
    formulario: Partial<Verificacao>,
  ) => {
    if (formulario.status === "Sem pendências" || verificacao.tipo === "antt") return 0;
    return verificacao.tipo === "camera_rastreador"
      ? Number(formulario.cameraValor || 0) + Number(formulario.rastreadorValor || 0)
      : Number(formulario.valor || 0);
  };

  const handleAdicionarOutroValor = (verificacao: Verificacao) => {
    setLancamentosPendentes((atuais) => [
      ...atuais,
      { form: { ...formVerif }, arquivos: [...arquivosAuditoria] },
    ]);
    setFormVerif((atual) => ({
      ...atual,
      valor: 0,
      cameraValor: 0,
      rastreadorValor: 0,
      observacoes: "",
      sinistroDescricao: "",
      perdaCargaDescricao: "",
      multasAutos: "",
      multasDataConferencia: "",
      abastecimentoNumeroNF: "",
      abastecimentoDataConferencia: "",
      estadiaDataConferencia: "",
      cameraRastreadorDataConferencia: "",
      estacionamentoDataConferencia: "",
      estacionamentoTag: "",
      pneusObservacao: "",
      pneusQuantidade: 0,
      anttData: "",
      suprimentosData: "",
    }));
    setArquivosAuditoria([]);
    setErroAuditoria("");
  };

  const handleSalvarEdicaoVerif = async (verificacaoId: string) => {
    const verificacao = distrato.verificacoes.find(
      (v) => v.id === verificacaoId,
    );
    if (!verificacao) return;
    const formularioAtualTemDados =
      valorDoFormulario(verificacao, formVerif) > 0 ||
      Boolean(formVerif.observacoes) ||
      Boolean(formVerif.abastecimentoNumeroNF) ||
      Boolean(formVerif.multasAutos) ||
      Boolean(formVerif.estacionamentoTag) ||
      arquivosAuditoria.length > 0;
    const entradas = [
      ...lancamentosPendentes,
      ...(lancamentosPendentes.length === 0 || formularioAtualTemDados
        ? [{ form: { ...formVerif }, arquivos: [...arquivosAuditoria] }]
        : []),
    ];
    const invalidos = entradas.flatMap((entrada) => entrada.arquivos).filter(
      (arquivo) =>
        !["application/pdf", "image/jpeg", "image/png"].includes(arquivo.type) ||
        arquivo.size > 10 * 1024 * 1024,
    );
    if (invalidos.length) {
      setErroAuditoria("Use somente PDF, JPG ou PNG de até 10 MB por arquivo.");
      return;
    }

    setSalvandoAuditoria(true);
    setErroAuditoria("");
    try {
      const novosLancamentos: LancamentoVerificacao[] = [];
      const novosAnexos: Anexo[] = [];
      for (const entrada of entradas) {
        const anexos: Anexo[] = [];
        for (const arquivo of entrada.arquivos) {
          const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
          const caminho = `${distrato.id}/auditorias/${crypto.randomUUID()}-${nomeSeguro}`;
          const { error } = await supabase.storage
            .from("documentos-distratos")
            .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
          if (error) throw error;
          const anexo: Anexo = {
            id: `aud-${crypto.randomUUID()}`,
            nome: arquivo.name,
            tipo: arquivo.type,
            url: caminho,
            tamanhoKb: Math.ceil(arquivo.size / 1024),
            dataUpload: new Date().toISOString(),
            usuarioId: usuarioAtual.id,
            usuarioNome: usuarioAtual.nome,
            categoria: `Auditoria - ${verificacao.titulo}`,
            descricao: entrada.form.observacoes || `Anexo de ${verificacao.titulo}`,
            origem: "Auditorias",
          };
          anexos.push(anexo);
          novosAnexos.push(anexo);
          adicionarDocumento(distrato.id, anexo);
        }
        const numeroDocumento =
          entrada.form.abastecimentoNumeroNF ||
          entrada.form.multasAutos ||
          entrada.form.estacionamentoTag ||
          undefined;
        const dataLancamento =
          entrada.form.abastecimentoDataConferencia ||
          entrada.form.multasDataConferencia ||
          entrada.form.estadiaDataConferencia ||
          entrada.form.cameraRastreadorDataConferencia ||
          entrada.form.estacionamentoDataConferencia ||
          entrada.form.anttData ||
          entrada.form.suprimentosData ||
          new Date().toISOString().slice(0, 10);
        novosLancamentos.push({
          id: `lanc-${crypto.randomUUID()}`,
          data: dataLancamento,
          valor: valorDoFormulario(verificacao, entrada.form),
          numeroDocumento,
          observacoes: entrada.form.observacoes || "",
          anexos,
          usuarioId: usuarioAtual.id,
          usuarioNome: usuarioAtual.nome,
          criadoEm: new Date().toISOString(),
        });
      }
    const lancamentoLegado: LancamentoVerificacao | null =
      !verificacao.lancamentos?.length && Number(verificacao.valor || 0) > 0
        ? {
            id: `legado-${verificacao.id}`,
            data: verificacao.dataAuditoria || distrato.dataCriacao,
            valor: Number(verificacao.valor || 0),
            numeroDocumento:
              verificacao.abastecimentoNumeroNF ||
              verificacao.multasAutos ||
              verificacao.estacionamentoTag,
            observacoes: verificacao.observacoes || "Registro anterior",
            anexos: verificacao.anexos || [],
            usuarioId: verificacao.responsavelId || "legado",
            usuarioNome: verificacao.responsavelNome || "Registro anterior",
            criadoEm: verificacao.dataAuditoria || distrato.dataCriacao,
          }
        : null;
    const lancamentosAnteriores = verificacao.lancamentos ||
      (lancamentoLegado ? [lancamentoLegado] : []);
    const lancamentos = [...lancamentosAnteriores, ...novosLancamentos];
    const total = lancamentos.reduce((soma, item) => soma + Number(item.valor || 0), 0);
    const ultimoFormulario = entradas.at(-1)?.form || formVerif;
    atualizarVerificacao(distrato.id, verificacaoId, {
      ...ultimoFormulario,
      status: total > 0 ? "Pendência encontrada" : ultimoFormulario.status,
      valor: total,
      anexos: [...(verificacao.anexos || []), ...novosAnexos],
      lancamentos,
      dataAuditoria: new Date().toISOString(),
    });
    setEditandoVerifId(null);
    setFormVerif({});
    setArquivosAuditoria([]);
    setLancamentosPendentes([]);
    } catch (error) {
      setErroAuditoria(
        `Não foi possível salvar: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    } finally {
      setSalvandoAuditoria(false);
    }
  };

  const salvarEdicaoLancamento = () => {
    if (!detalheLancamento) return;
    const verificacao = distrato.verificacoes.find(
      (item) => item.id === detalheLancamento.verificacaoId,
    );
    if (!verificacao) return;
    if (!Number.isFinite(detalheLancamento.lancamento.valor)) {
      window.alert("Informe um valor válido para a dívida.");
      return;
    }
    const totalJaPago = totalPagoNaDivida(detalheLancamento.lancamento.id);
    if (Number(detalheLancamento.lancamento.valor) + 0.009 < totalJaPago) {
      window.alert(
        `O valor da dívida não pode ser menor que o total já pago (${formatarMoeda(totalJaPago)}).`,
      );
      return;
    }
    const lancamentos = (verificacao.lancamentos || []).map((item) =>
      item.id === detalheLancamento.lancamento.id
        ? detalheLancamento.lancamento
        : item,
    );
    const total = lancamentos.reduce(
      (soma, item) => soma + Number(item.valor || 0),
      0,
    );
    atualizarVerificacao(distrato.id, verificacao.id, {
      lancamentos,
      valor: total,
      status: total > 0 ? "Pendência encontrada" : "Sem pendências",
      observacoes: detalheLancamento.lancamento.observacoes || "",
    });
    setDetalheLancamento((atual) =>
      atual ? { ...atual, editando: false } : null,
    );
  };

  const excluirLancamento = (
    verificacao: Verificacao,
    lancamento: LancamentoVerificacao,
  ) => {
    if (totalPagoNaDivida(lancamento.id) > 0) {
      window.alert(
        "Este lançamento possui pagamento vinculado. Cancele ou estorne o pagamento antes de excluir a dívida.",
      );
      return;
    }
    if (!window.confirm("Tem certeza que deseja excluir este lançamento?")) return;
    const lancamentos = (verificacao.lancamentos || []).filter(
      (item) => item.id !== lancamento.id,
    );
    const total = lancamentos.reduce(
      (soma, item) => soma + Number(item.valor || 0),
      0,
    );
    atualizarVerificacao(distrato.id, verificacao.id, {
      lancamentos,
      valor: total,
      status: lancamentos.length
        ? total > 0
          ? "Pendência encontrada"
          : "Sem pendências"
        : "Aguardando análise",
    });
  };

  // Manipulador de Pagamento
  const handleSalvarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = valorTextoParaNumero(formPagamento.valor);
    if (val <= 0) return;
    if (!dividaSelecionada) {
      setErroPagamento("Selecione a dívida em aberto que recebeu este pagamento.");
      return;
    }
    if (val > dividaSelecionada.saldo + 0.009) {
      setErroPagamento(
        `O valor informado é maior que o saldo desta dívida (${formatarMoeda(dividaSelecionada.saldo)}).`,
      );
      return;
    }
    if (!comprovantePagamento) {
      setErroPagamento("Anexe o comprovante real antes de confirmar a baixa.");
      return;
    }
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(
        comprovantePagamento.type,
      ) ||
      comprovantePagamento.size > 10 * 1024 * 1024
    ) {
      setErroPagamento("Escolha um comprovante PDF, JPG ou PNG de até 10 MB.");
      return;
    }

    setEnviandoPagamento(true);
    setErroPagamento("");
    let caminhoComprovante = "";
    try {
      const nomeSeguro = comprovantePagamento.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(-120);
      caminhoComprovante = `${distrato.id}/${crypto.randomUUID()}-${nomeSeguro}`;
      const { error } = await supabase.storage
        .from("documentos-distratos")
        .upload(caminhoComprovante, comprovantePagamento, {
          contentType: comprovantePagamento.type,
          upsert: false,
        });
      if (error) throw error;

      adicionarDocumento(distrato.id, {
        nome: comprovantePagamento.name,
        tipo: comprovantePagamento.type,
        tamanhoKb: Math.ceil(comprovantePagamento.size / 1024),
        categoria: "Comprovante de pagamento",
        descricao: `${dividaSelecionada.descricao} • ${formPagamento.formaPagamento} • ${formatarMoeda(val)}`,
        origem: "Cobrança e pagamentos",
        url: caminhoComprovante,
      });

      adicionarPagamento(distrato.id, {
        valor: val,
        data: formPagamento.data,
        formaPagamento: formPagamento.formaPagamento,
        categoria: formPagamento.categoria,
        dividaId: dividaSelecionada.id,
        dividaDescricao: dividaSelecionada.descricao,
        verificacaoId: dividaSelecionada.verificacaoId,
        lancamentoId: dividaSelecionada.lancamentoId,
        observacao: formPagamento.observacao,
        comprovanteNome: comprovantePagamento.name,
        comprovanteUrl: caminhoComprovante,
      });

      setModalNovoPagamento(false);
      setComprovantePagamento(null);
      setFormPagamento({
        valor: "",
        data: new Date().toISOString().slice(0, 10),
        formaPagamento: "PIX",
        categoria: "Aluguel",
        dividaId: "",
        observacao: "",
        comprovanteNome: "",
      });
    } catch (error) {
      setErroPagamento(
        `Não foi possível enviar o comprovante: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    } finally {
      setEnviandoPagamento(false);
      if (comprovantePagamentoInput.current)
        comprovantePagamentoInput.current.value = "";
    }
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
          {supervisor && distrato.statusGeral === "Quitado" && (
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

          {podeImprimir && (
            <button
              id="btn-imprimir-relatorio-termo"
              type="button"
              onClick={onOpenImprimir}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#7e1d2c] hover:bg-[#681623] active:bg-[#54101a] border border-[#c59b4c]/40 text-stone-100 text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#dfc28d]" />
              <span>Imprimir Termo & Relatório</span>
            </button>
          )}
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
              Código:{" "}
              <strong className="font-mono text-stone-200">
                {distrato.agregadoCodigo}
              </strong>{" "}
              • Operação: {distrato.gridOperacao} ({distrato.segmento})
            </p>
            {podeEditarCadastro && (
              <button
                type="button"
                onClick={abrirEdicaoCadastro}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition"
              >
                <Pencil className="w-3.5 h-3.5 text-[#dfc28d]" />
                Editar dados cadastrais
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-stone-400">
                Status Geral
              </div>
              <div className="mt-0.5">
                <StatusBadge status={distrato.statusGeral} size="md" />
              </div>
            </div>
            <div className="text-right pl-3 border-l border-white/10">
              <div className="text-[10px] uppercase font-bold text-stone-400">
                Financeiro
              </div>
              <div className="mt-0.5">
                <StatusBadge status={distrato.statusFinanceiro} size="md" />
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Informações do Veículo e Responsabilidade */}
        <div className="px-4 sm:px-6 py-3 bg-[#fcfbf9] border-b border-stone-200 grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-stone-400 block text-[11px]">
              Tipo de Veículo
            </span>
            <span className="font-bold text-stone-800">
              {distrato.tipoDistrato}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block text-[11px]">Placa(s)</span>
            <span className="font-mono font-bold text-stone-900">
              {distrato.placaCavalo}{" "}
              {distrato.placaCarreta ? `/ ${distrato.placaCarreta}` : ""}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block text-[11px]">
              Termo de Agregação
            </span>
            <span className="font-semibold text-stone-800">
              {distrato.statusTermoAgregacao}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block text-[11px]">
              Criado por
            </span>
            <span className="font-semibold text-stone-800">
              {distrato.responsavelAtualNome}
            </span>
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
              Aluguel: {formatarMoeda(distrato.debitoAluguel)} + Auditorias de
              Pátio
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
              {distrato.pagamentos.length} lançamento(s) de crédito
              registrado(s)
            </span>
          </div>

          <div className="sm:pl-4 pt-3 sm:pt-0">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
              Saldo Devedor Remanescente
            </span>
            <span
              className={`text-2xl font-black font-mono mt-1 block ${
                saldoRestante === 0
                  ? "text-emerald-700"
                  : distrato.statusFinanceiro === "Vencido"
                    ? "text-[#8e192a]"
                    : "text-stone-900"
              }`}
            >
              {formatarMoeda(saldoRestante)}
            </span>
            <span className="text-[11px] text-stone-500 mt-1 block">
              {saldoRestante === 0
                ? "Processo 100% liquidado"
                : "Aguardando quitação pelo transportador"}
            </span>
          </div>
        </div>
      </div>

      {/* Navegação entre as Abas Internas do Processo */}
      <div className="border-b border-stone-200 bg-white rounded-xl p-1.5 shadow-2xs flex flex-wrap gap-1.5 text-xs">
        {verificacoesVisiveis.length > 0 && (
          <button
            type="button"
            onClick={() => setAbaInterna("auditorias")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
              abaInterna === "auditorias"
                ? "bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Truck className="w-4 h-4 text-[#dfc28d]" />
            <span>
              Verificações e Auditorias ({verificacoesVisiveis.length})
            </span>
          </button>
        )}

        {podeAcessarFinanceiro && (
          <button
            type="button"
            onClick={() => setAbaInterna("financeiro")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
              abaInterna === "financeiro"
                ? "bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <DollarSign className="w-4 h-4 text-[#dfc28d]" />
            <span>Cobrança, Boletos & Pagamentos</span>
          </button>
        )}

        {podeAcessarJuridico && (
          <button
            type="button"
            onClick={() => setAbaInterna("juridico")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
              abaInterna === "juridico"
                ? "bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Landmark className="w-4 h-4 text-[#dfc28d]" />
            <span>Cobrança Jurídica (Protesto & Execução)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setAbaInterna("documentos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
            abaInterna === "documentos"
              ? "bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          <FileText className="w-4 h-4 text-[#dfc28d]" />
          <span>Documentos & Comprovantes ({distrato.documentos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaInterna("historico")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
            abaInterna === "historico"
              ? "bg-[#29080d] text-stone-100 shadow-2xs border border-[#c59b4c]/40"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          <History className="w-4 h-4 text-[#dfc28d]" />
          <span>Trilha de Auditoria ({distrato.historico.length})</span>
        </button>
      </div>

      {mensagemArquivo && abaInterna !== "documentos" && (
        <p
          role="status"
          className="rounded-xl border border-[#ead8b8] bg-[#fff9ed] px-4 py-3 text-xs font-semibold text-[#704b12]"
        >
          {mensagemArquivo}
        </p>
      )}

      {/* ABA 1: AS 11 VERIFICAÇÕES OBRIGATÓRIAS */}
      {abaInterna === "auditorias" && (
        <div className="space-y-4">
          <div className="detail-info-card bg-[#fbf9f5] p-4 rounded-xl border border-stone-200 text-xs text-stone-700 flex items-start gap-3">
            <Info className="w-5 h-5 text-[#865d1d] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-stone-900">
                Auditoria Multisetorial de Pendências
              </p>
              <p className="mt-0.5 text-stone-600">
                Cada área responsável deve conferir seu respectivo item e
                cadastrar se há pendência financeira, custos de manutenção,
                avarias ou se o item está regularizado. Os valores somam
                automaticamente no saldo do distrato.
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
                  Valor apurado no momento do pedido de encerramento pelo setor
                  de Logística.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                <span className="text-xs text-stone-400 block font-medium">
                  Valor Contratual
                </span>
                <span className="text-base font-bold font-mono text-stone-900">
                  {formatarMoeda(distrato.debitoAluguel)}
                </span>
                {distrato.debitoAluguel > 0 && (() => {
                  const situacao = situacaoDivida("aluguel-contratual", distrato.debitoAluguel);
                  return (
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${situacao.classe}`}>
                      {situacao.texto}
                    </span>
                  );
                })()}
                </div>
                {podeEditarCadastro && (
                  <button
                    type="button"
                    onClick={abrirEdicaoCadastro}
                    className="p-2 rounded-lg border border-stone-300 text-[#7e1d2c] hover:bg-[#f8ecee] transition"
                    title="Editar débito contratual — Logística"
                    aria-label="Editar débito inicial de aluguel"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* As 11 Verificações */}
            {verificacoesVisiveis.map((v, index) => {
              const estaEditando = editandoVerifId === v.id;
              const valorItem =
                v.tipo === "camera_rastreador"
                  ? v.lancamentos?.length
                    ? v.valor
                    : (v.cameraValor || 0) + (v.rastreadorValor || 0)
                  : v.valor;

              return (
                <div
                  key={v.id}
                  id={`card-verificacao-${v.id}`}
                  className={`card-gradient-hover verification-card bg-white rounded-xl border transition p-4 ${
                    estaEditando
                      ? "border-[#7e1d2c] ring-2 ring-[#7e1d2c]/10 shadow-md"
                      : "border-stone-200/90 shadow-2xs hover:border-stone-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#fbf6ee] border border-[#f0e3ce] text-[#865d1d] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900 text-sm">
                            {v.titulo}
                          </h3>
                          <span className="text-[11px] text-stone-400">
                            • Área:{" "}
                            <strong className="text-stone-700">
                              {v.areaResponsavel || areaPorTipo[v.tipo]}
                            </strong>
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {v.descricao}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <StatusBadge status={v.status} size="sm" />
                        <div className="text-xs font-mono font-bold text-stone-800 mt-1">
                          {formatarMoeda(valorItem)}
                        </div>
                      </div>

                      {!estaEditando && podeEditarVerificacao(v.tipo) && (
                        <button
                          type="button"
                          onClick={() => handleIniciarEdicaoVerif(v)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition cursor-pointer"
                        >
                          + Incluir
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detalhes / Observações quando não está editando */}
                  {!estaEditando && (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-3 text-[11px] text-stone-500">
                      {!!v.lancamentos?.length && (
                        <div className="rounded-lg border border-stone-200 bg-stone-50/70 overflow-hidden">
                          <div className="px-3 py-2 font-bold text-stone-700 bg-stone-100/80">
                            {v.lancamentos.length} lançamento(s) registrado(s)
                          </div>
                          <div className="divide-y divide-stone-200">
                            {v.lancamentos.map((lancamento) => {
                              const situacao = situacaoDivida(lancamento.id, Number(lancamento.valor));
                              return (
                              <div key={lancamento.id} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white transition">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <strong className="text-stone-800">
                                      {lancamento.observacoes || `Lançamento de ${v.titulo}`}
                                    </strong>
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${situacao.classe}`}>
                                      {situacao.texto}
                                    </span>
                                  </div>
                                  {lancamento.numeroDocumento && (
                                    <span className="mt-1 block">Documento/NF: {lancamento.numeroDocumento}</span>
                                  )}
                                  {!!lancamento.anexos.length && (
                                    <span className="mt-1 block text-[#7e1d2c] font-semibold">
                                      {lancamento.anexos.length} anexo(s)
                                    </span>
                                  )}
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                  <span className="font-semibold text-stone-700">
                                    {formatarData(lancamento.data)} • {formatarMoeda(lancamento.valor)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetalheLancamento({
                                        verificacaoId: v.id,
                                        lancamento: { ...lancamento },
                                        editando: false,
                                      })
                                    }
                                    className="p-1.5 rounded-md text-[#7e1d2c] hover:bg-[#f8ecee]"
                                    title="Visualizar detalhes"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {podeEditarVerificacao(v.tipo) && (
                                    <button
                                      type="button"
                                      onClick={() => excluirLancamento(v, lancamento)}
                                      className="p-1.5 rounded-md text-red-700 hover:bg-red-50"
                                      title="Excluir lançamento"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )})}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        {v.observacoes ? (
                          <span>
                            <strong>Parecer:</strong> {v.observacoes}
                          </span>
                        ) : (
                          <span className="italic text-stone-400">
                            Nenhuma ressalva anotada.
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 text-stone-400">
                        {v.responsavelAuditoria && (
                          <span>Auditor: {v.responsavelAuditoria} • </span>
                        )}
                        Conferido em: {formatarDataHora(v.dataAuditoria)}
                      </div>
                      </div>
                    </div>
                  )}

                  {/* Painel de Edição da Verificação */}
                  {estaEditando && (
                    <div className="mt-4 pt-4 border-t border-stone-200 bg-[#faf8f5] -mx-4 -mb-4 p-4 rounded-b-xl space-y-3">
                      <div className="text-xs font-bold text-[#7e1d2c] uppercase tracking-wider">
                        Atualizar Auditoria do Item • {usuarioAtual.nome} (
                        {usuarioAtual.perfil === "admin"
                          ? "supervisor"
                          : usuarioAtual.perfil}
                        )
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
                            <option value="Sem pendências">
                              Sem pendências
                            </option>
                            <option value="Pendência encontrada">
                              Pendência encontrada (Com Débito)
                            </option>
                          </select>
                        </div>

                        {/* Valor apurado (ou campos separados se for camera_rastreador) */}
                        {v.tipo === "camera_rastreador" ? (
                          <>
                            <div>
                              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                                Custo Câmera de Cabine (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={formVerif.cameraValor ?? ""}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    cameraValor: e.target.value === "" ? undefined : Number(e.target.value),
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
                                value={formVerif.rastreadorValor ?? ""}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    rastreadorValor: e.target.value === "" ? undefined : Number(e.target.value),
                                  }))
                                }
                                className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                              />
                            </div>
                          </>
                        ) : v.tipo === "antt" ? (
                          <div>
                            <label className="block text-[11px] font-bold text-stone-700 mb-1">
                              Situação da desvinculação
                            </label>
                            <select
                              value={formVerif.anttStatus || "Em observação"}
                              onChange={(e) =>
                                setFormVerif((prev) => ({
                                  ...prev,
                                  anttStatus: e.target.value as
                                    "Em observação" | "Finalizado",
                                  valor: 0,
                                }))
                              }
                              className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white outline-none"
                            >
                              <option value="Em observação">
                                Em observação
                              </option>
                              <option value="Finalizado">Finalizado</option>
                            </select>
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                                Valor do Débito / Avaria (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={formVerif.valor ?? ""}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    valor: e.target.value === "" ? undefined : Number(e.target.value),
                                  }))
                                }
                                className="w-full px-3 py-1.5 text-xs font-mono font-bold border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                              />
                            </div>
                            {v.tipo === "pneus" && (
                              <div>
                                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                                  Quantidade de pneus
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={formVerif.pneusQuantidade ?? ""}
                                  onChange={(e) =>
                                    setFormVerif((prev) => ({
                                      ...prev,
                                      pneusQuantidade: e.target.value === ""
                                        ? undefined
                                        : Math.max(0, parseInt(e.target.value, 10)),
                                    }))
                                  }
                                  className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white outline-none"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {v.tipo === "manutencao" && (
                          <label className="text-[11px] font-bold text-stone-700">
                            Tipo de manutenção
                            <select
                              value={formVerif.manutencaoTipo || "Mecânica"}
                              onChange={(e) =>
                                setFormVerif((prev) => ({
                                  ...prev,
                                  manutencaoTipo: e.target
                                    .value as Verificacao["manutencaoTipo"],
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white font-normal"
                            >
                              <option>Mecânica</option>
                              <option>Elétrica</option>
                              <option>Funilaria</option>
                              <option>Pneus</option>
                              <option>Outros</option>
                            </select>
                          </label>
                        )}
                        {v.tipo === "sinistro" && (
                          <label className="text-[11px] font-bold text-stone-700">
                            Descrição do sinistro
                            <input
                              value={formVerif.sinistroDescricao || ""}
                              onChange={(e) =>
                                setFormVerif((prev) => ({
                                  ...prev,
                                  sinistroDescricao: e.target.value,
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                              placeholder="Descreva o sinistro ou a avaria"
                            />
                          </label>
                        )}
                        {v.tipo === "perda_carga" && (
                          <label className="text-[11px] font-bold text-stone-700">
                            Descrição da perda de carga
                            <input
                              value={formVerif.perdaCargaDescricao || ""}
                              onChange={(e) =>
                                setFormVerif((prev) => ({
                                  ...prev,
                                  perdaCargaDescricao: e.target.value,
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                            />
                          </label>
                        )}
                        {v.tipo === "multas" && (
                          <>
                            <label className="text-[11px] font-bold text-stone-700">
                              Data de conferência
                              <input
                                type="date"
                                value={formVerif.multasDataConferencia || ""}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    multasDataConferencia: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                              />
                            </label>
                            <label className="text-[11px] font-bold text-stone-700">
                              Auto(s) da multa
                              <input
                                value={formVerif.multasAutos || ""}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    multasAutos: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                                placeholder="Número do auto ou tipo da multa"
                              />
                            </label>
                          </>
                        )}
                        {v.tipo === "abastecimento" && (
                          <>
                            <label className="text-[11px] font-bold text-stone-700">
                              Data de conferência
                              <input
                                type="date"
                                value={
                                  formVerif.abastecimentoDataConferencia || ""
                                }
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    abastecimentoDataConferencia:
                                      e.target.value,
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                              />
                            </label>
                            <label className="text-[11px] font-bold text-stone-700">
                              Número da nota fiscal
                              <input
                                value={formVerif.abastecimentoNumeroNF || ""}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    abastecimentoNumeroNF: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                                placeholder="Ex.: NF 46764"
                              />
                            </label>
                          </>
                        )}
                        {v.tipo === "estadia" && (
                          <label className="text-[11px] font-bold text-stone-700">
                            Data de conferência
                            <input
                              type="date"
                              value={formVerif.estadiaDataConferencia || ""}
                              onChange={(e) =>
                                setFormVerif((prev) => ({
                                  ...prev,
                                  estadiaDataConferencia: e.target.value,
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                            />
                          </label>
                        )}
                        {v.tipo === "camera_rastreador" && (
                          <label className="text-[11px] font-bold text-stone-700">
                            Data de conferência
                            <input
                              type="date"
                              value={
                                formVerif.cameraRastreadorDataConferencia || ""
                              }
                              onChange={(e) =>
                                setFormVerif((prev) => ({
                                  ...prev,
                                  cameraRastreadorDataConferencia:
                                    e.target.value,
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                            />
                          </label>
                        )}
                        {v.tipo === "estacionamento" && (
                          <>
                            <label className="text-[11px] font-bold text-stone-700">
                              Data de conferência
                              <input
                                type="date"
                                value={
                                  formVerif.estacionamentoDataConferencia || ""
                                }
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    estacionamentoDataConferencia:
                                      e.target.value,
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                              />
                            </label>
                            <label className="text-[11px] font-bold text-stone-700">
                              TAG / Identificação
                              <input
                                value={formVerif.estacionamentoTag || ""}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    estacionamentoTag: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                              />
                            </label>
                          </>
                        )}
                        {v.tipo === "antt" && (
                          <label className="text-[11px] font-bold text-stone-700">
                            Data da desvinculação
                            <input
                              type="date"
                              value={formVerif.anttData || ""}
                              onChange={(e) =>
                                setFormVerif((prev) => ({
                                  ...prev,
                                  anttData: e.target.value,
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                            />
                          </label>
                        )}
                        {v.tipo === "suprimentos" && (
                          <>
                            <label className="text-[11px] font-bold text-stone-700">
                              Data da auditoria
                              <input
                                type="date"
                                value={formVerif.suprimentosData || ""}
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    suprimentosData: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 border rounded-lg font-normal"
                              />
                            </label>
                            <label className="text-[11px] font-bold text-stone-700">
                              Resultado da fiscalização
                              <select
                                value={
                                  formVerif.suprimentosResultado || "Pendente"
                                }
                                onChange={(e) =>
                                  setFormVerif((prev) => ({
                                    ...prev,
                                    suprimentosResultado: e.target
                                      .value as Verificacao["suprimentosResultado"],
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 border rounded-lg bg-white font-normal"
                              >
                                <option>Pendente</option>
                                <option>Conforme</option>
                                <option>Inconforme</option>
                              </select>
                            </label>
                          </>
                        )}
                      </div>

                      {/* Observações da Auditoria */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Parecer Técnico / Observações da Auditoria
                        </label>
                        <input
                          type="text"
                          value={formVerif.observacoes || ""}
                          onChange={(e) =>
                            setFormVerif((prev) => ({
                              ...prev,
                              observacoes: e.target.value,
                            }))
                          }
                          placeholder="Descreva detalhes de notas fiscais, fotos de avaria, laudo mecânico ou motivo de isenção..."
                          className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                        />
                      </div>

                      <div className="rounded-lg border border-dashed border-[#b98a43] bg-white p-3">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Anexos deste lançamento
                        </label>
                        <input
                          key={lancamentosPendentes.length}
                          type="file"
                          multiple
                          accept="application/pdf,image/jpeg,image/png"
                          onChange={(event) =>
                            setArquivosAuditoria(Array.from(event.target.files || []))
                          }
                          className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#f8ecee] file:px-3 file:py-2 file:font-bold file:text-[#7e1d2c]"
                        />
                        <p className="mt-1 text-[10px] text-stone-500">
                          PDF, JPG ou PNG, até 10 MB cada. Os arquivos também aparecerão em Documentos &amp; Comprovantes.
                        </p>
                        {!!arquivosAuditoria.length && (
                          <p className="mt-1 text-[10px] font-semibold text-emerald-700">
                            {arquivosAuditoria.length} arquivo(s) selecionado(s).
                          </p>
                        )}
                        {erroAuditoria && (
                          <p className="mt-2 text-[11px] font-semibold text-red-700">{erroAuditoria}</p>
                        )}
                      </div>

                      {!!lancamentosPendentes.length && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                          <p className="text-[11px] font-bold text-emerald-900 mb-2">
                            {lancamentosPendentes.length} lançamento(s) preparado(s) para salvar
                          </p>
                          <div className="space-y-3">
                            {lancamentosPendentes.map((pendente, indice) => (
                              <div key={indice} className="rounded-xl bg-white border border-emerald-200 p-4 text-xs space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <strong className="text-emerald-900">Lançamento adicional #{indice + 1}</strong>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLancamentosPendentes((atuais) =>
                                      atuais.filter((_, itemIndice) => itemIndice !== indice),
                                    )
                                  }
                                  className="text-red-700 hover:bg-red-50 rounded-md p-1"
                                  aria-label={`Remover lançamento ${indice + 1}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  <label className="font-bold text-stone-700">
                                    Resultado da análise
                                    <select
                                      value={pendente.form.status}
                                      onChange={(event) =>
                                        setLancamentosPendentes((atuais) =>
                                          atuais.map((item, itemIndice) =>
                                            itemIndice === indice
                                              ? { ...item, form: { ...item.form, status: event.target.value as StatusVerificacao } }
                                              : item,
                                          ),
                                        )
                                      }
                                      className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-normal"
                                    >
                                      <option value="Sem pendências">Sem pendências</option>
                                      <option value="Pendência encontrada">Pendência encontrada (Com Débito)</option>
                                    </select>
                                  </label>
                                  <label className="font-bold text-stone-700">
                                    Valor do débito / avaria (R$)
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        v.tipo === "camera_rastreador"
                                          ? pendente.form.cameraValor == null && pendente.form.rastreadorValor == null
                                            ? ""
                                            : Number(pendente.form.cameraValor || 0) + Number(pendente.form.rastreadorValor || 0)
                                          : pendente.form.valor ?? ""
                                      }
                                      onChange={(event) =>
                                        setLancamentosPendentes((atuais) =>
                                          atuais.map((item, itemIndice) =>
                                            itemIndice === indice
                                              ? {
                                                  ...item,
                                                  form:
                                                    v.tipo === "camera_rastreador"
                                                      ? {
                                                          ...item.form,
                                                          cameraValor: event.target.value === "" ? undefined : Number(event.target.value),
                                                          rastreadorValor: event.target.value === "" ? undefined : 0,
                                                        }
                                                      : { ...item.form, valor: event.target.value === "" ? undefined : Number(event.target.value) },
                                                }
                                              : item,
                                          ),
                                        )
                                      }
                                      className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg font-mono font-normal"
                                    />
                                  </label>
                                  <label className="font-bold text-stone-700">
                                    Documento / Nota fiscal
                                    <input
                                      value={pendente.form.abastecimentoNumeroNF || pendente.form.multasAutos || pendente.form.estacionamentoTag || ""}
                                      onChange={(event) =>
                                        setLancamentosPendentes((atuais) =>
                                          atuais.map((item, itemIndice) => {
                                            if (itemIndice !== indice) return item;
                                            const campo = v.tipo === "abastecimento" ? "abastecimentoNumeroNF" : v.tipo === "estacionamento" ? "estacionamentoTag" : "multasAutos";
                                            return { ...item, form: { ...item.form, [campo]: event.target.value } };
                                          }),
                                        )
                                      }
                                      className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg font-normal"
                                      placeholder="Número da NF, auto, tag ou documento"
                                    />
                                  </label>
                                </div>
                                <label className="block font-bold text-stone-700">
                                  Observações
                                  <input
                                    value={pendente.form.observacoes || ""}
                                    onChange={(event) =>
                                      setLancamentosPendentes((atuais) =>
                                        atuais.map((item, itemIndice) =>
                                          itemIndice === indice
                                            ? { ...item, form: { ...item.form, observacoes: event.target.value } }
                                            : item,
                                        ),
                                      )
                                    }
                                    className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg font-normal"
                                  />
                                </label>
                                <label className="block rounded-lg border border-dashed border-[#b98a43] p-3 font-bold text-stone-700">
                                  Anexos deste lançamento
                                  <input
                                    type="file"
                                    multiple
                                    accept="application/pdf,image/jpeg,image/png"
                                    onChange={(event) =>
                                      setLancamentosPendentes((atuais) =>
                                        atuais.map((item, itemIndice) =>
                                          itemIndice === indice
                                            ? { ...item, arquivos: Array.from(event.target.files || []) }
                                            : item,
                                        ),
                                      )
                                    }
                                    className="mt-2 block w-full font-normal file:mr-3 file:rounded-md file:border-0 file:bg-[#f8ecee] file:px-3 file:py-2 file:font-bold file:text-[#7e1d2c]"
                                  />
                                  {!!pendente.arquivos.length && (
                                    <span className="mt-1 block text-emerald-700">{pendente.arquivos.length} arquivo(s) selecionado(s)</span>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Botões de Ação */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleAdicionarOutroValor(v)}
                          disabled={salvandoAuditoria}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#7e1d2c] bg-white border border-[#d9b8bd] hover:bg-[#fff5f6] rounded-lg"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar outro valor
                        </button>
                        <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoVerifId(null);
                            setLancamentosPendentes([]);
                            setArquivosAuditoria([]);
                          }}
                          className="px-3 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200 rounded-lg transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSalvarEdicaoVerif(v.id)}
                          disabled={salvandoAuditoria}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] rounded-lg shadow-2xs transition cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5 text-[#dfc28d]" />
                          <span>{salvandoAuditoria ? "Salvando…" : "Salvar lançamento(s)"}</span>
                        </button>
                        </div>
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
      {abaInterna === "financeiro" && (
        <div className="space-y-6">
          {/* Ações Rápidas de Cobrança */}
          <div className="card-gradient-hover flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">
                Gestão de Pagamentos & Boletos
              </h3>
              <p className="text-xs text-stone-500">
                Anexe o boleto recebido do banco, confira os dados e registre o
                pagamento quando ele for realmente identificado.
              </p>
            </div>

            <div className="flex flex-col min-[420px]:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  abrirAnexoContextual(
                    "Cobrança e pagamentos",
                    "Boleto de cobrança",
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#7e1d2c] bg-[#fcf3f4] hover:bg-[#f6e3e6] rounded-xl transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Ler e anexar boleto</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const primeiraDivida = dividasEmAberto[0];
                  setErroPagamento("");
                  setComprovantePagamento(null);
                  setFormPagamento((prev) => ({
                    ...prev,
                    valor: "",
                    categoria: primeiraDivida?.categoria || "Outros",
                    dividaId: primeiraDivida?.id || "",
                    observacao: "",
                  }));
                  setModalNovoPagamento(true);
                }}
                disabled={!dividasEmAberto.length}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                Nenhum boleto real foi anexado a este processo.
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
                        <span className="font-bold text-stone-900">
                          {b.arquivoNome ||
                            b.numeroDocumento ||
                            "Boleto anexado"}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.status === "Pago"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.status === "Vencido"
                                ? "bg-rose-100 text-[#8e192a]"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      {b.linhaDigitavel && (
                        <div className="mt-1 font-mono text-[11px] text-stone-500 truncate max-w-lg">
                          Linha digitável: {b.linhaDigitavel}
                        </div>
                      )}
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
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f6e8c9] text-[#7a5315]">
                            {p.categoria || "Outros"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                            Forma: {p.formaPagamento}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Registrado em {formatarData(p.data)} por{" "}
                          {p.usuarioNome}
                          {p.observacao && ` • Obs: ${p.observacao}`}
                        </p>
                        <p className="text-[11px] text-[#7e1d2c] font-semibold mt-1">
                          {p.dividaDescricao
                            ? `Vinculado a: ${p.dividaDescricao}`
                            : "Pagamento antigo sem vínculo individual com uma dívida"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {p.comprovanteNome && (
                        <button
                          type="button"
                          onClick={() =>
                            void baixarArquivo(
                              p.comprovanteNome || "comprovante",
                              p.comprovanteUrl,
                            )
                          }
                          className="text-[11px] text-[#7e1d2c] hover:underline font-semibold"
                        >
                          📎 {p.comprovanteNome}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const just = prompt(
                            "Informe a justificativa do estorno/cancelamento deste pagamento:",
                          );
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
      {abaInterna === "juridico" && (
        <div className="space-y-6">
          {/* Card de Informações e Fluxo */}
          <div className="bg-[#fbf9f5] p-5 rounded-2xl border border-stone-200 space-y-3 text-xs text-stone-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#7e1d2c] flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#7e1d2c]" />
                <span>Fluxo Extrajudicial & Execução Judicial de Títulos</span>
              </h3>
              <button
                type="button"
                onClick={() =>
                  abrirAnexoContextual("Jurídico", "Documento jurídico")
                }
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] rounded-xl transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Anexar documento jurídico
              </button>
            </div>
            <p className="leading-relaxed text-stone-600">
              Caso o agregado não efetue a quitação amigável das pendências
              contratuais dentro do prazo do boleto bancário, o título é
              conferido documentalmente pelo setor de Cobrança e encaminhado
              para <strong>Protesto em Cartório</strong> ou{" "}
              <strong>Ajuizamento de Ação de Execução</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bloco 1: Protesto em Cartório */}
            <div className="card-gradient-hover bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#8e192a]" />
                  <h4 className="font-bold text-stone-900 text-sm">
                    Protesto Extrajudicial
                  </h4>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    distrato.encaminhadoProtesto
                      ? "bg-purple-100 text-purple-900 border border-purple-300"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {distrato.encaminhadoProtesto
                    ? "Encaminhado"
                    : "Não encaminhado"}
                </span>
              </div>

              {distrato.encaminhadoProtesto ? (
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-1">
                    <p className="font-bold text-purple-950">
                      Cartório de Registro:
                    </p>
                    <p className="text-purple-900">
                      {distrato.cartorioProtesto || "Cartório não informado"}
                    </p>
                    <p className="text-purple-800 text-[11px] mt-1">
                      Data de envio:{" "}
                      {distrato.dataEnvioProtesto
                        ? formatarData(distrato.dataEnvioProtesto)
                        : "N/A"}{" "}
                      • Custas: {formatarMoeda(distrato.custasCartorio || 0)}
                    </p>
                    {distrato.comprovanteProtestoId && (
                      <p className="text-purple-800 text-[11px]">
                        Comprovante vinculado:{" "}
                        {distrato.documentos.find(
                          (doc) => doc.id === distrato.comprovanteProtestoId,
                        )?.nome || "Documento não encontrado"}
                      </p>
                    )}
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
                      ✓ Protesto Efetivado em{" "}
                      {formatarData(distrato.dataEfetivacaoProtesto)}
                      {distrato.comprovanteEfetivacaoProtestoId && (
                        <span className="block mt-1">
                          Comprovante:{" "}
                          {distrato.documentos.find(
                            (doc) =>
                              doc.id ===
                              distrato.comprovanteEfetivacaoProtestoId,
                          )?.nome || "Documento não encontrado"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-stone-500">
                    Registre aqui apenas um encaminhamento realmente realizado
                    fora do sistema, após conferência pelo jurídico.
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
                  <h4 className="font-bold text-stone-900 text-sm">
                    Ação Judicial de Execução
                  </h4>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    distrato.encaminhadoAjuizamento
                      ? "bg-rose-100 text-rose-900 border border-rose-300"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {distrato.encaminhadoAjuizamento
                    ? "Ajuizado"
                    : "Não ajuizado"}
                </span>
              </div>

              {distrato.encaminhadoAjuizamento ? (
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 space-y-1">
                    <p className="font-bold text-rose-950 font-mono">
                      Processo: {distrato.numeroProcessoJudicial}
                    </p>
                    <p className="text-rose-900">
                      {distrato.varaComarca || "Vara e comarca não informadas"}
                    </p>
                    <p className="text-rose-800 text-[11px] mt-1">
                      Data da Distribuição:{" "}
                      {distrato.dataAjuizamento
                        ? formatarData(distrato.dataAjuizamento)
                        : "N/A"}{" "}
                      • Valor da Causa:{" "}
                      {formatarMoeda(
                        distrato.valorAcaoJudicial || saldoRestante,
                      )}
                    </p>
                    {distrato.comprovanteAjuizamentoId && (
                      <p className="text-rose-800 text-[11px]">
                        Comprovante vinculado:{" "}
                        {distrato.documentos.find(
                          (doc) => doc.id === distrato.comprovanteAjuizamentoId,
                        )?.nome || "Documento não encontrado"}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-stone-500">
                    Registre aqui apenas um ajuizamento já realizado pelo
                    jurídico fora deste sistema.
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
          {!podeRegistrarJuridico && (
            <p className="text-sm text-amber-900">
              {saldoRestante <= 0
                ? "Registro indisponível: este distrato não possui saldo em aberto."
                : "Registro indisponível: exige perfil jurídico ou supervisor."}
            </p>
          )}
        </div>
      )}

      {/* ABA 4: DOCUMENTOS & ANEXOS */}
      {abaInterna === "documentos" && (
        <div className="space-y-4">
          <div className="card-gradient-hover bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  Repositório de Documentos
                </h3>
                <p className="text-xs text-stone-500">
                  Termos assinados, laudos fotográficos de pátio, certidões ANTT
                  e comprovantes de pagamento.
                </p>
              </div>
              <input
                ref={arquivoInput}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                aria-label="Escolher documento para anexar"
                onChange={(event) =>
                  void anexarArquivo(event.target.files?.[0])
                }
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={baixandoPasta}
                  onClick={() => void baixarPastaCompleta()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#7e1d2c] bg-white border border-[#d9b8bd] hover:bg-[#fff5f6] rounded-xl transition disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {baixandoPasta ? "Preparando…" : "Baixar pasta completa"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={enviandoArquivo}
                  onClick={() => arquivoInput.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-stone-100 bg-[#7e1d2c] hover:bg-[#681623] rounded-xl shadow-2xs transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#dfc28d]" />
                  <span>
                    {enviandoArquivo ? "Enviando…" : "Anexar Arquivo"}
                  </span>
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-[220px_1fr] gap-3 border-t border-stone-100 pt-4">
              <label className="text-xs font-bold text-stone-700">
                Categoria do documento
                <select
                  value={categoriaDocumento}
                  onChange={(e) => setCategoriaDocumento(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-normal"
                >
                  <option>Contrato de aluguel</option>
                  <option>Boleto de cobrança</option>
                  <option>Comprovante de pagamento</option>
                  <option>Documento da ANTT</option>
                  <option>Documento jurídico</option>
                  <option>Comprovante de protesto</option>
                  <option>Comprovante de ajuizamento</option>
                  <option>Certidão / Cartório</option>
                  <option>Laudo de manutenção</option>
                  <option>Multa</option>
                  <option>Nota fiscal de abastecimento</option>
                  <option>Outros</option>
                </select>
              </label>
              <label className="text-xs font-bold text-stone-700">
                Descrição do documento
                <input
                  type="text"
                  value={descricaoDocumento}
                  onChange={(e) => setDescricaoDocumento(e.target.value)}
                  placeholder="Ex.: contrato de aluguel da carreta, boleto ou comprovante do PIX"
                  className="mt-1.5 w-full px-3 py-2 border border-stone-300 rounded-lg font-normal"
                />
              </label>
            </div>
          </div>

          {mensagemArquivo && (
            <p role="status" className="text-sm text-[#7e1d2c]">
              {mensagemArquivo}
            </p>
          )}

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
                    <p className="font-bold text-xs text-stone-900 truncate">
                      {doc.nome}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-[#f6e8c9] text-[#704b12] text-[10px] font-bold">
                        {doc.categoria || "Documento geral"}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-semibold">
                        {doc.origem || "Documentos gerais"}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {doc.tamanhoKb} KB
                      </span>
                    </div>
                    {doc.descricao && (
                      <p className="text-[11px] text-stone-600 mt-1">
                        {doc.descricao}
                      </p>
                    )}
                    <p className="text-[10px] text-stone-400 mt-1">
                      Enviado por {doc.usuarioNome} em{" "}
                      {formatarData(doc.dataUpload)}
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
      {abaInterna === "historico" && (
        <div className="card-gradient-hover bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-6 space-y-4">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">
              Trilha de Auditoria Imutável
            </h3>
            <p className="text-xs text-stone-500">
              Registro cronológico de todas as modificações, pareceres e
              lançamentos com carimbo de usuário.
            </p>
          </div>

          <div className="relative border-l-2 border-stone-200 ml-4 space-y-6 pt-2">
            {distrato.historico.map((h) => (
              <div key={h.id} className="relative pl-6 text-xs">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#7e1d2c] border-2 border-white ring-2 ring-stone-200" />
                <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                  <span>{formatarDataHora(h.dataHora)}</span>
                  <span>•</span>
                  <span className="font-semibold text-stone-700">
                    {h.usuarioNome}
                  </span>
                  <span>({h.usuarioPerfil})</span>
                </div>
                <p className="font-bold text-stone-900 mt-0.5">
                  Alteração em "{h.campoAlterado}":
                </p>
                <div className="mt-1 p-2 rounded-lg bg-stone-50 border border-stone-100 text-stone-600 text-[11px] font-mono">
                  De:{" "}
                  <span className="text-stone-400">
                    {h.valorAnterior || "Vazio"}
                  </span>{" "}
                  → Para:{" "}
                  <span className="text-stone-900 font-bold">
                    {h.valorNovo}
                  </span>
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
              <h3 className="text-sm font-bold text-stone-100">
                Registrar Pagamento / Quitação
              </h3>
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
                    setFormPagamento((prev) => ({
                      ...prev,
                      valor: limparEntradaDecimal(e.target.value),
                    }));
                  }}
                  inputMode="decimal"
                  className="w-full px-3 py-2 text-sm font-bold font-mono border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#7e1d2c]/20 outline-none"
                  autoFocus
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Saldo devedor atual: {formatarMoeda(saldoRestante)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Categoria do pagamento
                </label>
                <select
                  value={formPagamento.categoria}
                  onChange={(e) =>
                    setFormPagamento((prev) => ({
                      ...prev,
                      categoria: e.target.value as NonNullable<
                        Pagamento["categoria"]
                      >,
                      dividaId: "",
                    }))
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white outline-none"
                >
                  <option value="Aluguel">Aluguel</option>
                  <option value="Abastecimento">Abastecimento</option>
                  <option value="Multa">Multa</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Estacionamento">Estacionamento</option>
                  <option value="Câmera e Rastreador">
                    Câmera e Rastreador
                  </option>
                  <option value="Pneus">Pneus</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Dívida que está sendo paga <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formPagamento.dividaId}
                  onChange={(e) => {
                    const divida = dividasEmAberto.find((item) => item.id === e.target.value);
                    setFormPagamento((prev) => ({
                      ...prev,
                      dividaId: e.target.value,
                      categoria: divida?.categoria || prev.categoria,
                    }));
                    setErroPagamento("");
                  }}
                  className="w-full px-3 py-2.5 text-xs border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#7e1d2c]/20"
                >
                  <option value="">Selecione uma dívida em aberto</option>
                  {dividasEmAberto
                    .filter((divida) => divida.categoria === formPagamento.categoria)
                    .map((divida) => (
                      <option key={divida.id} value={divida.id}>
                        {divida.descricao} — saldo {formatarMoeda(divida.saldo)}
                      </option>
                    ))}
                </select>
                {dividaSelecionada && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                    Valor original: <strong>{formatarMoeda(dividaSelecionada.valor)}</strong>
                    {dividaSelecionada.pago > 0 && (
                      <> • Já pago: <strong>{formatarMoeda(dividaSelecionada.pago)}</strong></>
                    )}
                    <> • Saldo: <strong>{formatarMoeda(dividaSelecionada.saldo)}</strong></>
                  </div>
                )}
                {!dividasEmAberto.some((divida) => divida.categoria === formPagamento.categoria) && (
                  <p className="mt-1 text-[11px] text-stone-500">
                    Não existem dívidas em aberto nesta categoria.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Data do Pagamento
                  </label>
                  <input
                    type="date"
                    required
                    value={formPagamento.data}
                    onChange={(e) =>
                      setFormPagamento((prev) => ({
                        ...prev,
                        data: e.target.value,
                      }))
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
                    <option value="Compensação em Frete">
                      Compensação em Frete
                    </option>
                    <option value="Depósito Identificado">
                      Depósito Identificado
                    </option>
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
                    setFormPagamento((prev) => ({
                      ...prev,
                      observacao: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Comprovante do pagamento{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={comprovantePagamentoInput}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(event) => {
                    setComprovantePagamento(event.target.files?.[0] || null);
                    setErroPagamento("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => comprovantePagamentoInput.current?.click()}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed text-left transition ${
                    comprovantePagamento
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-stone-300 bg-stone-50 hover:border-[#a82d40] hover:bg-[#fff7f8] text-stone-600"
                  }`}
                >
                  {comprovantePagamento ? (
                    <FileCheck className="w-5 h-5 shrink-0" />
                  ) : (
                    <Upload className="w-5 h-5 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-xs font-bold truncate">
                      {comprovantePagamento
                        ? comprovantePagamento.name
                        : "Selecionar comprovante"}
                    </span>
                    <span className="block text-[10px] mt-0.5 opacity-75">
                      PDF, JPG ou PNG de até 10 MB
                    </span>
                  </span>
                </button>
                {erroPagamento && (
                  <p role="alert" className="mt-1.5 text-[11px] text-rose-700">
                    {erroPagamento}
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalNovoPagamento(false);
                    setErroPagamento("");
                    setComprovantePagamento(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoPagamento}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs disabled:opacity-60"
                >
                  {enviandoPagamento
                    ? "Enviando comprovante…"
                    : "Confirmar Pagamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalheLancamento && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-stone-200">
            <div className="sticky top-0 px-6 py-4 bg-[#26070a] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Detalhes do lançamento</h3>
                <p className="text-[11px] text-stone-300 mt-0.5">Informações da dívida e documentos vinculados</p>
              </div>
              <button type="button" onClick={() => setDetalheLancamento(null)} aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="font-bold text-stone-700">
                  Data
                  <input
                    type="date"
                    disabled={!detalheLancamento.editando}
                    value={detalheLancamento.lancamento.data?.slice(0, 10) || ""}
                    onChange={(event) =>
                      setDetalheLancamento((atual) =>
                        atual ? { ...atual, lancamento: { ...atual.lancamento, data: event.target.value } } : null,
                      )
                    }
                    className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white disabled:bg-stone-50 font-normal"
                  />
                </label>
                <label className="font-bold text-stone-700">
                  Valor da dívida
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!detalheLancamento.editando}
                    value={Number.isNaN(detalheLancamento.lancamento.valor) ? "" : detalheLancamento.lancamento.valor}
                    onChange={(event) =>
                      setDetalheLancamento((atual) =>
                        atual ? { ...atual, lancamento: { ...atual.lancamento, valor: event.target.value === "" ? Number.NaN : Number(event.target.value) } } : null,
                      )
                    }
                    className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white disabled:bg-stone-50 font-mono font-normal"
                  />
                </label>
              </div>
              <label className="block font-bold text-stone-700">
                Documento / Nota fiscal
                <input
                  disabled={!detalheLancamento.editando}
                  value={detalheLancamento.lancamento.numeroDocumento || ""}
                  onChange={(event) =>
                    setDetalheLancamento((atual) =>
                      atual ? { ...atual, lancamento: { ...atual.lancamento, numeroDocumento: event.target.value } } : null,
                    )
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white disabled:bg-stone-50 font-normal"
                />
              </label>
              <label className="block font-bold text-stone-700">
                Observações
                <textarea
                  disabled={!detalheLancamento.editando}
                  value={detalheLancamento.lancamento.observacoes || ""}
                  onChange={(event) =>
                    setDetalheLancamento((atual) =>
                      atual ? { ...atual, lancamento: { ...atual.lancamento, observacoes: event.target.value } } : null,
                    )
                  }
                  rows={3}
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white disabled:bg-stone-50 font-normal resize-none"
                />
              </label>
              <div>
                <p className="font-bold text-stone-700 mb-2">Anexos</p>
                {(detalheLancamento.lancamento.anexos || []).length ? (
                  <div className="space-y-2">
                    {(detalheLancamento.lancamento.anexos || []).map((anexo) => (
                      <button
                        key={anexo.id}
                        type="button"
                        onClick={() => void baixarArquivo(anexo.nome, anexo.url)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-stone-200 hover:border-[#7e1d2c] hover:bg-[#fff8f8] text-left"
                      >
                        <span className="flex items-center gap-2 font-semibold text-stone-800">
                          <FileText className="w-4 h-4 text-[#7e1d2c]" /> {anexo.nome}
                        </span>
                        <Download className="w-4 h-4 text-stone-500" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-stone-50 border border-stone-200 p-3 text-stone-500">Nenhum anexo vinculado a este lançamento.</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button type="button" onClick={() => setDetalheLancamento(null)} className="px-4 py-2 font-semibold text-stone-600">
                  Fechar
                </button>
                {detalheLancamento.editando ? (
                  <button type="button" onClick={salvarEdicaoLancamento} className="inline-flex items-center gap-2 px-4 py-2 font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] rounded-lg">
                    <Save className="w-4 h-4" /> Salvar alterações
                  </button>
                ) : (
                  <button type="button" onClick={() => setDetalheLancamento((atual) => atual ? { ...atual, editando: true } : null)} className="inline-flex items-center gap-2 px-4 py-2 font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] rounded-lg">
                    <Pencil className="w-4 h-4" /> Editar lançamento
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CORREÇÃO DOS DADOS CADASTRAIS */}
      {modalEditarCadastro && podeEditarCadastro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-stone-200">
            <div className="sticky top-0 px-6 py-4 bg-[#26070a] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Editar dados cadastrais</h3>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  O código {distrato.agregadoCodigo} permanece automático.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarCadastro(false)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
              onSubmit={(event) => {
                event.preventDefault();
                const debitoAluguel = Number.isFinite(formCadastro.debitoAluguel)
                  ? formCadastro.debitoAluguel
                  : 0;
                const aluguelJaPago = totalPagoNaDivida("aluguel-contratual");
                if (debitoAluguel + 0.009 < aluguelJaPago) {
                  window.alert(
                    `O débito de aluguel não pode ser menor que o total já pago (${formatarMoeda(aluguelJaPago)}).`,
                  );
                  return;
                }
                atualizarDadosCadastrais(distrato.id, {
                  agregadoNome: formCadastro.agregadoNome.trim(),
                  placaCavalo: formCadastro.placaCavalo,
                  placaCarreta: formCadastro.placaCarreta,
                  tipoDistrato: formCadastro.tipoDistrato,
                  gridOperacao:
                    formCadastro.gridOperacao === "Outro"
                      ? formCadastro.gridOutro.trim() || "Outro"
                      : formCadastro.gridOperacao,
                  segmento:
                    formCadastro.segmento === "Outro"
                      ? formCadastro.segmentoOutro.trim() || "Outro"
                      : formCadastro.segmento,
                  debitoAluguel,
                  statusTermoAgregacao: formCadastro.statusTermoAgregacao,
                });
                setModalEditarCadastro(false);
              }}
            >
              <label className="sm:col-span-2 font-bold text-stone-700">
                Nome do agregado
                <input
                  required
                  value={formCadastro.agregadoNome}
                  onChange={(e) =>
                    setFormCadastro((atual) => ({
                      ...atual,
                      agregadoNome: e.target.value,
                    }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg font-normal"
                />
              </label>
              <label className="font-bold text-stone-700">
                Placa do cavalo
                <input
                  value={formCadastro.placaCavalo}
                  onChange={(e) =>
                    setFormCadastro((atual) => ({
                      ...atual,
                      placaCavalo: e.target.value,
                    }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg font-mono font-normal uppercase"
                />
              </label>
              <label className="font-bold text-stone-700">
                Placa da carreta
                <input
                  value={formCadastro.placaCarreta}
                  onChange={(e) =>
                    setFormCadastro((atual) => ({
                      ...atual,
                      placaCarreta: e.target.value,
                    }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg font-mono font-normal uppercase"
                />
              </label>
              <label className="font-bold text-stone-700 order-1">
                Tipo de veículo
                <select
                  value={formCadastro.tipoDistrato}
                  onChange={(e) =>
                    setFormCadastro((atual) => ({
                      ...atual,
                      tipoDistrato: e.target.value as Distrato["tipoDistrato"],
                    }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white font-normal"
                >
                  <option>Cavalo</option>
                  <option>Carreta</option>
                  <option>Cavalo e Carreta</option>
                </select>
              </label>
              <label className="font-bold text-stone-700 order-3 rounded-xl border border-[#eadfce] bg-[#fcfaf7] p-3">
                Grid
                <select
                  value={formCadastro.gridOperacao}
                  onChange={(e) =>
                    setFormCadastro((atual) => ({
                      ...atual,
                      gridOperacao: e.target.value,
                    }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white font-normal"
                >
                  <option value="Uruguai">Uruguai</option>
                  <option value="México">México</option>
                  <option value="EUA">EUA</option>
                  <option value="Outro">Outro</option>
                </select>
                {formCadastro.gridOperacao === "Outro" && (
                  <span className="mt-3 block border-t border-[#eadfce] pt-3">
                    <span className="block text-[10px] uppercase tracking-wide text-stone-500">Outro grid (opcional)</span>
                    <input
                      value={formCadastro.gridOutro}
                      onChange={(e) =>
                        setFormCadastro((atual) => ({ ...atual, gridOutro: e.target.value }))
                      }
                      placeholder="Ex.: Argentina"
                      className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white font-normal"
                    />
                  </span>
                )}
              </label>
              <label className="font-bold text-stone-700 order-4 rounded-xl border border-[#eadfce] bg-[#fcfaf7] p-3">
                Segmento
                <select
                  value={formCadastro.segmento}
                  onChange={(e) =>
                    setFormCadastro((atual) => ({ ...atual, segmento: e.target.value }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white font-normal"
                >
                  <option value="Aço">Aço</option>
                  <option value="Vegetal">Vegetal</option>
                  <option value="Graneleiro">Graneleiro</option>
                  <option value="Outro">Outro</option>
                </select>
                {formCadastro.segmento === "Outro" && (
                  <span className="mt-3 block border-t border-[#eadfce] pt-3">
                    <span className="block text-[10px] uppercase tracking-wide text-stone-500">Outro segmento (opcional)</span>
                    <input
                      value={formCadastro.segmentoOutro}
                      onChange={(e) =>
                        setFormCadastro((atual) => ({ ...atual, segmentoOutro: e.target.value }))
                      }
                      placeholder="Ex.: Madeira"
                      className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white font-normal"
                    />
                  </span>
                )}
              </label>
              <label className="font-bold text-stone-700 order-5 sm:col-span-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                Débito inicial de aluguel (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number.isNaN(formCadastro.debitoAluguel) ? "" : formCadastro.debitoAluguel}
                  onChange={(e) =>
                    setFormCadastro((atual) => ({
                      ...atual,
                      debitoAluguel: e.target.value === "" ? Number.NaN : Number(e.target.value),
                    }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg font-mono font-normal"
                />
                <span className="mt-1 block text-[10px] font-normal text-stone-500">
                  Preenchimento e correção de responsabilidade da Logística.
                </span>
              </label>
              <label className="font-bold text-stone-700 order-2">
                Termo de agregação
                <select
                  value={formCadastro.statusTermoAgregacao}
                  onChange={(e) =>
                    setFormCadastro((atual) => ({
                      ...atual,
                      statusTermoAgregacao: e.target
                        .value as Distrato["statusTermoAgregacao"],
                    }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white font-normal"
                >
                  <option>Ativo</option>
                  <option>Suspenso</option>
                  <option>Em Encerramento</option>
                  <option>Rescindido</option>
                </select>
              </label>
              <div className="order-6 sm:col-span-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t border-stone-200">
                {supervisor && <button
                  type="button"
                  onClick={() => {
                    setErroExclusao("");
                    setModalConfirmarExclusao(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 font-bold text-red-700 border border-red-200 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir distrato
                </button>}
                <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalEditarCadastro(false)}
                  className="px-4 py-2 font-semibold text-stone-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  Salvar correções
                </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalConfirmarExclusao && supervisor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-red-200 overflow-hidden">
            <div className="p-6">
              <div className="w-11 h-11 rounded-full bg-red-50 text-red-700 flex items-center justify-center mb-4">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-stone-900">Excluir este distrato?</h3>
              <p className="mt-2 text-sm text-stone-600">
                Tem certeza que gostaria de excluir <strong>{distrato.id} — {distrato.agregadoNome}</strong>? Dívidas, pagamentos, auditorias e documentos vinculados serão removidos. Esta ação não pode ser desfeita.
              </p>
              {erroExclusao && (
                <p className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                  {erroExclusao}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={excluindoDistrato}
                  onClick={() => setModalConfirmarExclusao(false)}
                  className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={excluindoDistrato}
                  onClick={async () => {
                    setExcluindoDistrato(true);
                    setErroExclusao("");
                    try {
                      await excluirDistrato(distrato.id);
                      onVoltar();
                    } catch (error) {
                      setErroExclusao(
                        `Não foi possível excluir: ${error instanceof Error ? error.message : "erro desconhecido"}`,
                      );
                    } finally {
                      setExcluindoDistrato(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  {excluindoDistrato ? "Excluindo…" : "Excluir definitivamente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ANEXO DIRETO DA ABA ATUAL */}
      {modalAnexo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#26070a] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Anexar arquivo</h3>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  Origem: {modalAnexo.origem}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAnexo(null)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-stone-600">
                O arquivo ficará vinculado a esta aba e também aparecerá em
                Documentos &amp; Comprovantes com sua etiqueta.
              </p>
              <label className="block font-bold text-stone-700">
                Tipo do documento
                <select
                  value={modalAnexo.categoria}
                  onChange={(event) =>
                    setModalAnexo((atual) =>
                      atual
                        ? { ...atual, categoria: event.target.value }
                        : atual,
                    )
                  }
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white font-normal"
                >
                  {modalAnexo.origem === "Cobrança e pagamentos" ? (
                    <>
                      <option>Boleto de cobrança</option>
                      <option>Comprovante de pagamento</option>
                      <option>Acordo de pagamento</option>
                      <option>Outros documentos financeiros</option>
                    </>
                  ) : (
                    <>
                      <option>Documento jurídico</option>
                      <option>Comprovante de protesto</option>
                      <option>Comprovante de ajuizamento</option>
                      <option>Certidão / Cartório</option>
                      <option>Outros documentos jurídicos</option>
                    </>
                  )}
                </select>
              </label>
              <label className="block font-bold text-stone-700">
                Descrição
                <input
                  type="text"
                  value={descricaoAnexoContextual}
                  onChange={(event) =>
                    setDescricaoAnexoContextual(event.target.value)
                  }
                  placeholder="Ex.: boleto da multa com vencimento em 20/09"
                  className="mt-1.5 w-full px-3 py-2.5 border border-stone-300 rounded-lg font-normal"
                />
              </label>
              <input
                ref={arquivoContextualInput}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(event) => {
                  const arquivo = event.target.files?.[0];
                  if (!arquivo) return;
                  if (modalAnexo.categoria === "Boleto de cobrança") {
                    void lerArquivoBoleto(arquivo);
                  } else {
                    void anexarArquivo(arquivo, {
                      categoria: modalAnexo.categoria,
                      descricao: descricaoAnexoContextual,
                      origem: modalAnexo.origem,
                    });
                  }
                }}
              />
              {modalAnexo.categoria === "Boleto de cobrança" &&
                arquivoBoleto && (
                  <div className="space-y-3 rounded-xl border border-[#ead8b8] bg-[#fffaf0] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-stone-800 truncate">
                        {arquivoBoleto.name}
                      </span>
                      {lendoBoleto && (
                        <span className="text-[10px] font-bold text-[#8e192a]">
                          Lendo…
                        </span>
                      )}
                    </div>
                    {resultadoLeitura && (
                      <p className="text-[11px] text-stone-600">
                        {resultadoLeitura}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="font-bold text-stone-700">
                        Valor do boleto
                        <input
                          value={dadosBoleto.valor}
                          onChange={(e) =>
                            setDadosBoleto((atual) => ({
                              ...atual,
                              valor: limparEntradaDecimal(e.target.value),
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-mono font-normal"
                        />
                      </label>
                      <label className="font-bold text-stone-700">
                        Vencimento
                        <input
                          type="date"
                          value={dadosBoleto.vencimento}
                          onChange={(e) =>
                            setDadosBoleto((atual) => ({
                              ...atual,
                              vencimento: e.target.value,
                            }))
                          }
                          className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-normal"
                        />
                      </label>
                    </div>
                    <label className="block font-bold text-stone-700">
                      Linha digitável
                      <input
                        value={dadosBoleto.linhaDigitavel}
                        onChange={(e) =>
                          setDadosBoleto((atual) => ({
                            ...atual,
                            linhaDigitavel: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        placeholder="Digite ou confira os números"
                        className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-mono font-normal"
                      />
                    </label>
                  </div>
                )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalAnexo(null)}
                  className="px-4 py-2 font-semibold text-stone-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={enviandoArquivo || lendoBoleto}
                  onClick={() => {
                    if (
                      modalAnexo.categoria === "Boleto de cobrança" &&
                      arquivoBoleto
                    ) {
                      const valor = valorTextoParaNumero(dadosBoleto.valor);
                      if (valor <= 0 || !dadosBoleto.vencimento) {
                        window.alert(
                          "Confira e informe o valor e o vencimento do boleto.",
                        );
                        return;
                      }
                      void anexarArquivo(arquivoBoleto, {
                        categoria: modalAnexo.categoria,
                        descricao: descricaoAnexoContextual,
                        origem: modalAnexo.origem,
                        boleto: {
                          valor,
                          vencimento: dadosBoleto.vencimento,
                          linhaDigitavel:
                            dadosBoleto.linhaDigitavel || undefined,
                        },
                      });
                      return;
                    }
                    arquivoContextualInput.current?.click();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 font-bold text-white bg-[#7e1d2c] hover:bg-[#681623] rounded-lg disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  {enviandoArquivo
                    ? "Enviando…"
                    : modalAnexo.categoria === "Boleto de cobrança" &&
                        arquivoBoleto
                      ? "Confirmar boleto"
                      : modalAnexo.categoria === "Boleto de cobrança"
                        ? "Selecionar boleto"
                        : "Escolher e anexar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EFETIVAÇÃO DO PROTESTO */}
      {modalEfetivacaoProtesto &&
        temPerfilJuridico &&
        distrato.encaminhadoProtesto &&
        !distrato.dataEfetivacaoProtesto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
              <div className="px-6 py-4 bg-[#26070a] text-white flex items-center justify-between">
                <h3 className="text-sm font-bold">
                  Registrar efetivação comprovada do protesto
                </h3>
                <button
                  type="button"
                  onClick={() => setModalEfetivacaoProtesto(false)}
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 text-xs">
                <p className="text-stone-600">
                  Registre somente após receber a confirmação do cartório. Use o
                  botão Anexar documento jurídico desta aba antes de continuar.
                </p>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Data da efetivação
                  </label>
                  <input
                    type="date"
                    value={formEfetivacaoProtesto.data}
                    onChange={(e) =>
                      setFormEfetivacaoProtesto((prev) => ({
                        ...prev,
                        data: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Comprovante da efetivação já anexado
                  </label>
                  <select
                    value={formEfetivacaoProtesto.comprovanteId}
                    onChange={(e) =>
                      setFormEfetivacaoProtesto((prev) => ({
                        ...prev,
                        comprovanteId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  >
                    <option value="">Selecione um arquivo anexado</option>
                    {comprovantesDisponiveis.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.nome}
                      </option>
                    ))}
                  </select>
                  {comprovantesDisponiveis.length === 0 && (
                    <p className="mt-1 text-amber-900">
                      Nenhum arquivo anexado de verdade a este distrato.
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalEfetivacaoProtesto(false)}
                    className="px-4 py-2 font-semibold text-stone-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !formEfetivacaoProtesto.data ||
                        !comprovantesDisponiveis.some(
                          (doc) =>
                            doc.id === formEfetivacaoProtesto.comprovanteId,
                        )
                      ) {
                        window.alert(
                          "Informe a data e selecione o comprovante real da efetivação.",
                        );
                        return;
                      }
                      efetivarProtesto(
                        distrato.id,
                        formEfetivacaoProtesto.data,
                        formEfetivacaoProtesto.comprovanteId,
                      );
                      setModalEfetivacaoProtesto(false);
                    }}
                    className="px-4 py-2 font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg"
                  >
                    Confirmar registro interno
                  </button>
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
              <h3 className="text-sm font-bold text-stone-100">
                Registrar protesto realizado fora do sistema
              </h3>
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
                  onChange={(e) =>
                    setFormProtesto((prev) => ({
                      ...prev,
                      cartorio: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Custas Cartorárias (R$)
                  </label>
                  <input
                    type="text"
                    value={formProtesto.custas}
                    onChange={(e) =>
                      setFormProtesto((prev) => ({
                        ...prev,
                        custas: limparEntradaDecimal(e.target.value),
                      }))
                    }
                    inputMode="decimal"
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
                    onChange={(e) =>
                      setFormProtesto((prev) => ({
                        ...prev,
                        dataEnvio: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Comprovante do encaminhamento já anexado
                </label>
                <select
                  value={formProtesto.comprovanteId}
                  onChange={(e) =>
                    setFormProtesto((prev) => ({
                      ...prev,
                      comprovanteId: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                >
                  <option value="">Selecione um arquivo anexado</option>
                  {comprovantesDisponiveis.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.nome}
                    </option>
                  ))}
                </select>
                {comprovantesDisponiveis.length === 0 && (
                  <p className="mt-1 text-amber-900">
                    Use o botão Anexar documento jurídico desta aba primeiro.
                  </p>
                )}
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
                    if (
                      !formProtesto.cartorio.trim() ||
                      !formProtesto.dataEnvio
                    ) {
                      window.alert("Informe o cartório e a data reais.");
                      return;
                    }
                    if (
                      !comprovantesDisponiveis.some(
                        (doc) => doc.id === formProtesto.comprovanteId,
                      )
                    ) {
                      window.alert(
                        "Selecione o comprovante real do encaminhamento.",
                      );
                      return;
                    }
                    const custas = valorTextoParaNumero(formProtesto.custas);
                    encaminharParaProtesto(
                      distrato.id,
                      formProtesto.cartorio,
                      custas,
                      formProtesto.dataEnvio,
                      formProtesto.comprovanteId,
                    );
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
              <h3 className="text-sm font-bold text-stone-100">
                Distribuição de Execução Judicial
              </h3>
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
                    setFormAjuizamento((prev) => ({
                      ...prev,
                      numeroProcesso: e.target.value,
                    }))
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
                    setFormAjuizamento((prev) => ({
                      ...prev,
                      varaComarca: e.target.value,
                    }))
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
                      setFormAjuizamento((prev) => ({
                        ...prev,
                        valorAcao: limparEntradaDecimal(e.target.value),
                      }))
                    }
                    inputMode="decimal"
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-stone-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Comprovante do ajuizamento já anexado
                </label>
                <select
                  value={formAjuizamento.comprovanteId}
                  onChange={(e) =>
                    setFormAjuizamento((prev) => ({
                      ...prev,
                      comprovanteId: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                >
                  <option value="">Selecione um arquivo anexado</option>
                  {comprovantesDisponiveis.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.nome}
                    </option>
                  ))}
                </select>
                {comprovantesDisponiveis.length === 0 && (
                  <p className="mt-1 text-amber-900">
                    Use o botão Anexar documento jurídico desta aba primeiro.
                  </p>
                )}
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
                    if (
                      !formAjuizamento.numeroProcesso.trim() ||
                      !formAjuizamento.varaComarca.trim()
                    ) {
                      window.alert(
                        "Informe o número de processo e a vara reais.",
                      );
                      return;
                    }
                    if (
                      !comprovantesDisponiveis.some(
                        (doc) => doc.id === formAjuizamento.comprovanteId,
                      )
                    ) {
                      window.alert(
                        "Selecione o comprovante real do ajuizamento.",
                      );
                      return;
                    }
                    const val =
                      valorTextoParaNumero(formAjuizamento.valorAcao) || saldoRestante;
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
              <h3 className="text-sm font-bold text-stone-100">
                Reabrir Processo Quitado
              </h3>
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
                A reabertura de um distrato concluído requer justificativa
                obrigatória e ficará registrada permanentemente na trilha de
                auditoria para fins de compliance.
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
                    setJustificativaReabertura("");
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
