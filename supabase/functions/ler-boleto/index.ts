declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return resposta({ erro: "Usuário não autenticado." }, 401);
    }

    const { arquivoBase64, mimeType, textoExtraido } = await req.json();
    const mimePermitido = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "text/plain",
    ].includes(mimeType);

    if ((!arquivoBase64 && !textoExtraido) || !mimePermitido) {
      return resposta({ erro: "Envie um boleto PDF, JPG ou PNG." }, 400);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return resposta(
        { erro: "A IA ainda não foi configurada no servidor." },
        500,
      );
    }

    const prompt = `Analise este boleto bancário brasileiro e extraia apenas dados realmente visíveis no documento. Não invente nem estime informações. Priorize os campos explicitamente rotulados como Vencimento e Valor do documento/Valor cobrado. Se houver linha digitável, confira se ela é compatível com o valor e sinalize qualquer divergência. O vencimento deve ser YYYY-MM-DD, o valor deve ser numérico e a linha digitável deve conter somente dígitos. Informe alertas quando houver dúvida, documento ilegível, divergência ou aparência de documento de teste.`;

    const partes: Array<Record<string, unknown>> = [
      {
        text: textoExtraido
          ? `${prompt}\n\nTexto extraído automaticamente do mesmo boleto (use apenas como apoio; confira o documento visual quando ele estiver anexado):\n${String(textoExtraido).slice(0, 30000)}`
          : prompt,
      },
    ];

    if (arquivoBase64 && mimeType !== "text/plain") {
      partes.push({
        inline_data: { mime_type: mimeType, data: arquivoBase64 },
      });
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 9000);

    let respostaGemini: Response;
    try {
      respostaGemini = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controlador.signal,
          body: JSON.stringify({
            contents: [{ parts: partes }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 512,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  valor: { type: "NUMBER", nullable: true },
                  vencimento: { type: "STRING", nullable: true },
                  linhaDigitavel: { type: "STRING", nullable: true },
                  banco: { type: "STRING", nullable: true },
                  beneficiario: { type: "STRING", nullable: true },
                  pagador: { type: "STRING", nullable: true },
                  documentoBeneficiario: { type: "STRING", nullable: true },
                  confianca: { type: "NUMBER" },
                  alertas: { type: "ARRAY", items: { type: "STRING" } },
                },
                required: [
                  "valor",
                  "vencimento",
                  "linhaDigitavel",
                  "banco",
                  "beneficiario",
                  "pagador",
                  "documentoBeneficiario",
                  "confianca",
                  "alertas",
                ],
              },
            },
          }),
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return resposta(
          { erro: "A análise por IA excedeu o tempo limite de 9 segundos." },
          504,
        );
      }
      throw error;
    } finally {
      clearTimeout(temporizador);
    }

    const bruto = await respostaGemini.json();
    if (!respostaGemini.ok) {
      console.error("Gemini:", bruto);
      return resposta(
        { erro: "A IA não conseguiu analisar o boleto agora." },
        502,
      );
    }

    const texto = bruto?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) {
      return resposta({ erro: "A IA não retornou dados do boleto." }, 422);
    }

    const dados = JSON.parse(texto);
    const linhaDigitavel = String(dados.linhaDigitavel || "").replace(/\D/g, "");
    const vencimento = /^\d{4}-\d{2}-\d{2}$/.test(String(dados.vencimento || ""))
      ? String(dados.vencimento)
      : null;
    const valor =
      typeof dados.valor === "number" &&
      Number.isFinite(dados.valor) &&
      dados.valor > 0
        ? dados.valor
        : null;

    return resposta({
      ...dados,
      valor,
      vencimento,
      linhaDigitavel: [44, 46, 47, 48].includes(linhaDigitavel.length)
        ? linhaDigitavel
        : "",
    });
  } catch (error) {
    console.error(error);
    return resposta({ erro: "Falha inesperada ao analisar o boleto." }, 500);
  }
});

function resposta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
