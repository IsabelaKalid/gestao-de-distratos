import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Mail,
  UserRound,
  Loader2,
  ShieldCheck,
  FileCheck2,
  Scale,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { BrandLogo } from "../components/BrandLogo";

export const AuthView: React.FC = () => {
  const { entrar, cadastrar, recuperarSenha } = useAuth();
  const [pagina, setPagina] = useState<"inicio" | "acesso">("inicio");
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [movimento, setMovimento] = useState({ x: 0, y: 0 });

  const abrirAcesso = (novoModo: "entrar" | "cadastrar") => {
    setModo(novoModo);
    setErro("");
    setMensagem("");
    setPagina("acesso");
  };
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setMensagem("");
    setEnviando(true);
    try {
      const falha =
        modo === "entrar"
          ? await entrar(email, senha)
          : await cadastrar(nome, email, senha);
      if (falha) setErro(falha);
      else if (modo === "cadastrar")
        setMensagem(
          "Cadastro realizado. Confirme seu e-mail e aguarde a aprovação de um supervisor.",
        );
    } finally {
      setEnviando(false);
    }
  };
  const recuperar = async () => {
    if (!email) {
      setErro("Informe seu e-mail primeiro.");
      return;
    }
    setErro("");
    setMensagem("");
    setEnviando(true);
    try {
      const falha = await recuperarSenha(email);
      if (falha) setErro(falha);
      else
        setMensagem("Enviamos as instruções de recuperação para seu e-mail.");
    } finally {
      setEnviando(false);
    }
  };

  if (pagina === "inicio")
    return (
      <main
        className="relative min-h-screen overflow-hidden bg-[#180305] text-white"
        onMouseMove={(e) =>
          setMovimento({
            x: (e.clientX / window.innerWidth - 0.5) * 14,
            y: (e.clientY / window.innerHeight - 0.5) * 10,
          })
        }
        onMouseLeave={() => setMovimento({ x: 0, y: 0 })}
      >
        <div
          className="absolute -inset-5 bg-cover bg-center transition-transform duration-700 ease-out"
          style={{
            backgroundImage: "url('/assets/transpanorama-frota.png')",
            transform: `translate(${movimento.x}px, ${movimento.y}px) scale(1.04)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#170204]/95 via-[#250508]/75 to-[#170204]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120203]/95 via-transparent to-[#1b0306]/60" />
        <section className="relative z-10 min-h-screen max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-8 flex flex-col justify-between">
          <div>
            <BrandLogo className="w-64 sm:w-80" />
            <p className="mt-2 text-xs text-[#e7c784]">
              Gestão de Distratos de Frotas
            </p>
          </div>
          <div className="max-w-2xl py-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d7aa55]/40 bg-[#29080d]/70 px-4 py-2 text-xs text-[#f0d79f]">
              <ShieldCheck className="w-4 h-4" /> Processos seguros, organizados
              e rastreáveis
            </span>
            <h1 className="mt-6 text-4xl sm:text-6xl font-black leading-[1.04]">
              Encerramentos contratuais em{" "}
              <span className="text-[#e5b95d]">movimento.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm sm:text-base leading-relaxed text-stone-200">
              Auditorias de frota, cobranças, documentos e encaminhamentos
              jurídicos reunidos em uma única operação.
            </p>
            <div className="mt-7 grid grid-cols-3 gap-2 max-w-lg">
              {(
                [
                  ["Auditorias", FileCheck2],
                  ["Cobranças", ShieldCheck],
                  ["Jurídico", Scale],
                ] as const
              ).map(([texto, Icon]) => (
                <div
                  key={texto}
                  className="brand-feature rounded-xl border border-white/15 bg-black/25 p-3 backdrop-blur-sm"
                >
                  <Icon className="w-4 h-4 text-[#e5b95d]" />
                  <p className="mt-2 text-xs font-semibold">{texto}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => abrirAcesso("cadastrar")}
                className="brand-action inline-flex items-center gap-2 rounded-xl bg-[#d7a845] px-5 py-3 text-sm font-bold text-[#220609] hover:bg-[#edc978] transition"
              >
                Criar minha conta <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => abrirAcesso("entrar")}
                className="brand-action inline-flex items-center gap-2 rounded-xl border border-white/25 bg-black/25 px-5 py-3 text-sm font-bold hover:bg-white/10 transition"
              >
                Já tenho uma conta <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-stone-400">
            Transpanorama Transportes • Acesso exclusivo para pessoas
            autorizadas
          </p>
        </section>
      </main>
    );

  return (
    <main className="relative min-h-screen bg-[#f7f3ed] grid lg:grid-cols-[1fr_0.85fr]">
      <section className="relative hidden lg:block overflow-hidden bg-[#240609]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/assets/transpanorama-frota.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#210407]/45 to-[#210407]/90" />
        <div className="relative h-full p-12 flex flex-col justify-between text-white">
          <BrandLogo className="w-72" />
          <div>
            <p className="text-[#e5b95d] font-bold">Gestão Integrada</p>
            <h1 className="mt-2 text-4xl font-black">
              Controle e rastreabilidade em cada etapa.
            </h1>
          </div>
          <p className="text-xs text-stone-300">
            Ambiente protegido e individual.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white border border-stone-200 shadow-xl rounded-3xl p-6 sm:p-9">
          <button
            type="button"
            onClick={() => setPagina("inicio")}
            className="mb-6 inline-flex items-center gap-2 text-sm text-stone-600 hover:text-[#7e1d2c]"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao início
          </button>
          <BrandLogo className="w-52" />
          <h2 className="mt-5 text-3xl font-black text-stone-900">
            {modo === "entrar" ? "Entrar no sistema" : "Criar sua conta"}
          </h2>
          {modo === "cadastrar" && (
            <p className="text-sm text-stone-500 mt-2">
              Sua conta será analisada por um supervisor.
            </p>
          )}
          <form onSubmit={enviar} className="mt-7 space-y-4">
            {modo === "cadastrar" && (
              <label className="block text-sm font-semibold text-stone-700">
                Nome completo
                <div className="mt-1.5 flex items-center border rounded-xl px-3">
                  <UserRound className="w-4 h-4 text-stone-400" />
                  <input
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full p-3 outline-none"
                    placeholder="Seu nome"
                  />
                </div>
              </label>
            )}
            <label className="block text-sm font-semibold text-stone-700">
              E-mail
              <div className="mt-1.5 flex items-center border rounded-xl px-3">
                <Mail className="w-4 h-4 text-stone-400" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 outline-none"
                  placeholder="nome@empresa.com.br"
                />
              </div>
            </label>
            <label className="block text-sm font-semibold text-stone-700">
              Senha
              <div className="mt-1.5 flex items-center border rounded-xl px-3">
                <LockKeyhole className="w-4 h-4 text-stone-400" />
                <input
                  required
                  minLength={8}
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full p-3 outline-none"
                  placeholder="No mínimo 8 caracteres"
                />
              </div>
            </label>
            {erro && (
              <p
                role="alert"
                className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"
              >
                {erro}
              </p>
            )}
            {mensagem && (
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">
                {mensagem}
              </p>
            )}
            <button
              disabled={enviando}
              className="w-full flex justify-center items-center gap-2 bg-[#7e1d2c] hover:bg-[#681623] text-white font-bold rounded-xl p-3 disabled:opacity-60"
            >
              {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
              {modo === "entrar" ? "Entrar" : "Cadastrar"}
            </button>
          </form>
          {modo === "entrar" && (
            <button
              type="button"
              onClick={recuperar}
              className="mt-4 text-sm text-[#7e1d2c] hover:underline"
            >
              Esqueci minha senha
            </button>
          )}
          <div className="border-t mt-6 pt-6 text-sm text-stone-600">
            {modo === "entrar"
              ? "Ainda não possui conta?"
              : "Já possui uma conta?"}{" "}
            <button
              type="button"
              onClick={() => {
                setModo(modo === "entrar" ? "cadastrar" : "entrar");
                setErro("");
                setMensagem("");
              }}
              className="font-bold text-[#7e1d2c] hover:underline"
            >
              {modo === "entrar" ? "Criar conta" : "Entrar"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
