import React, { useEffect, useState } from "react";
import { CheckCircle2, Database, Shield, Users } from "lucide-react";
import { useDistratos } from "../context/DistratoContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import type { Usuario } from "../types";

type UsuarioAdmin = Usuario & { aprovado?: boolean; ativo?: boolean };
const DEPARTAMENTOS = [
  "Logística",
  "Oficina",
  "Financeiro",
  "Abastecimento",
  "Multa",
  "Customer Service",
  "Tecnologia Integrada",
  "Estacionamento",
  "Almoxarifado",
  "Auditoria",
  "Auditoria de Suprimentos",
  "Jurídico",
  "Controladoria e Planejamento",
];

const perfilPorDepartamentos = (departamentos: string[]) => {
  if (!departamentos.length) return "pendente";
  if (departamentos.includes("Logística")) return "cadastro";
  if (departamentos.includes("Financeiro")) return "financeiro";
  if (departamentos.includes("Jurídico")) return "juridico";
  if (departamentos.includes("Oficina")) return "manutencao";
  return "verificacoes";
};

export const AdminView: React.FC = () => {
  const { usuarioAtual, distratos, erroDados } = useDistratos();
  const { atualizarPerfil } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [mensagem, setMensagem] = useState("");

  const carregarUsuarios = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("criado_em", { ascending: false });
    setUsuarios(
      (data || []).map((u: any) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        departamento: u.departamento || "",
        departamentos: Array.isArray(u.departamentos)
          ? u.departamentos.filter((d: string) => DEPARTAMENTOS.includes(d))
          : [],
        cargo: u.cargo || "",
        aprovado: u.aprovado,
        ativo: u.ativo,
      })),
    );
  };
  useEffect(() => {
    carregarUsuarios();
  }, []);

  const salvar = async (u: UsuarioAdmin) => {
    const departamentos = (u.departamentos || []).filter((d) =>
      DEPARTAMENTOS.includes(d),
    );
    const perfil =
      u.perfil === "admin" ? "admin" : perfilPorDepartamentos(departamentos);
    const erro = await atualizarPerfil(u.id, {
      perfil,
      departamento: departamentos[0] || "",
      departamentos,
      cargo: u.cargo,
      aprovado: Boolean(u.aprovado),
      ativo: u.ativo !== false,
    });
    setMensagem(
      erro
        ? `Não foi possível salvar: ${erro}`
        : `Perfil de ${u.nome} atualizado.`,
    );
    if (!erro) carregarUsuarios();
  };
  const alterar = (id: string, campo: keyof UsuarioAdmin, valor: any) =>
    setUsuarios((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [campo]: valor } : u)),
    );
  const alternarDepartamento = (id: string, departamento: string) =>
    setUsuarios((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const atuais = u.departamentos || [];
        const departamentos = atuais.includes(departamento)
          ? atuais.filter((d) => d !== departamento)
          : [...atuais, departamento];
        return {
          ...u,
          departamentos,
          perfil:
            u.perfil === "admin"
              ? "admin"
              : perfilPorDepartamentos(departamentos),
        };
      }),
    );
  if (usuarioAtual.perfil !== "admin") return null;

  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      <div>
        <p className="text-xs font-semibold text-[#865d1d]">
          Governança e acessos
        </p>
        <h1 className="text-xl sm:text-2xl font-black mt-1">
          Supervisão do sistema
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Aprove novos cadastros, escolha os departamentos e informe o cargo de
          cada pessoa.
        </p>
      </div>
      {mensagem && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-900">
          {mensagem}
        </div>
      )}
      {erroDados && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          Erro de sincronização: {erroDados}
        </div>
      )}
      <section className="card-gradient-hover bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b flex items-center gap-2">
          <Users className="w-5 h-5 text-[#7e1d2c]" />
          <h2 className="font-bold">Usuários cadastrados</h2>
        </div>
        <div className="divide-y">
          {usuarios.map((u) => (
            <div key={u.id} className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="min-w-0 lg:flex-1">
                  <p className="font-bold text-sm break-words">{u.nome}</p>
                  <p className="text-xs text-stone-500 break-all">{u.email}</p>
                </div>
                <label className="text-xs font-semibold lg:w-64">
                  Cargo
                  <input
                    value={u.cargo}
                    onChange={(e) => alterar(u.id, "cargo", e.target.value)}
                    className="mt-1 block w-full border rounded-lg p-2"
                    placeholder="Ex.: Chefe do Jurídico"
                  />
                </label>
                <label className="text-xs flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={u.perfil === "admin"}
                    onChange={(e) =>
                      alterar(
                        u.id,
                        "perfil",
                        e.target.checked
                          ? "admin"
                          : perfilPorDepartamentos(u.departamentos || []),
                      )
                    }
                  />
                  Supervisor
                </label>
                <label className="text-xs flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={Boolean(u.aprovado)}
                    onChange={(e) =>
                      alterar(u.id, "aprovado", e.target.checked)
                    }
                  />
                  Aprovado
                </label>
                <button
                  onClick={() => salvar(u)}
                  className="px-5 py-2 rounded-lg bg-[#7e1d2c] text-white text-xs font-bold"
                >
                  Salvar
                </button>
              </div>
              {u.perfil === "admin" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                  <strong>Supervisor:</strong> acesso total a todos os
                  departamentos e funções do sistema.
                </div>
              ) : (
                <details className="group rounded-xl border-2 border-[#d4ae62] bg-[#fffaf0] shadow-sm open:bg-white">
                  <summary className="cursor-pointer list-none px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 text-xs font-semibold hover:bg-[#fbf1dc] rounded-xl transition">
                    <span className="text-[#7e1d2c]">
                      Departamentos de acesso{" "}
                      <strong className="ml-2 text-[#93651f]">
                        Clique para selecionar ▾
                      </strong>
                    </span>
                    <span className="text-stone-500 font-normal truncate">
                      {(u.departamentos || []).length
                        ? `${(u.departamentos || []).length} selecionado(s): ${(u.departamentos || []).join(", ")}`
                        : "Nenhum selecionado"}
                    </span>
                  </summary>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 border-t border-stone-200 p-4 bg-white rounded-b-xl">
                    {DEPARTAMENTOS.map((d) => (
                      <label
                        key={d}
                        className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 cursor-pointer transition ${(u.departamentos || []).includes(d) ? "border-[#b86b76] bg-[#fcf3f4] text-[#7e1d2c]" : "border-stone-200 hover:bg-stone-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={(u.departamentos || []).includes(d)}
                          onChange={() => alternarDepartamento(u.id, d)}
                        />
                        <span>{d}</span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
          {!usuarios.length && (
            <p className="p-6 text-sm text-stone-500">
              Nenhum usuário encontrado.
            </p>
          )}
        </div>
      </section>
      <section className="card-gradient-hover bg-white rounded-2xl border border-stone-200 p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <h2 className="font-bold">Dados iniciais</h2>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Exibindo {distratos.length} distratos carregados do banco de dados.
          </p>
        </div>
        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs">
          Base operacional ativa
        </span>
      </section>
      <section className="grid md:grid-cols-2 gap-4">
        <div className="card-gradient-hover bg-white border rounded-2xl p-5">
          <Shield className="text-[#865d1d]" />
          <h3 className="font-bold mt-3">Contas individuais</h3>
          <p className="text-sm text-stone-500 mt-1">
            Cada alteração usa o usuário autenticado, sem alternância de nomes.
          </p>
        </div>
        <div className="card-gradient-hover bg-white border rounded-2xl p-5">
          <CheckCircle2 className="text-emerald-600" />
          <h3 className="font-bold mt-3">Aprovação da supervisão</h3>
          <p className="text-sm text-stone-500 mt-1">
            Novas contas permanecem bloqueadas até receberem perfil e aprovação.
          </p>
        </div>
      </section>
    </div>
  );
};
