import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type SupportedProvider = "google" | "ollama" | "openai";

/**
 * Retorna um LanguageModel configurado de acordo com as variáveis de ambiente.
 *
 * Variáveis:
 *   AI_PROVIDER  — "google" | "ollama" | "openai"  (padrão: "google")
 *   AI_MODEL     — nome do modelo                   (padrão por provider)
 *
 *   Google Gemini:
 *     GEMINI_API_KEY   — obrigatória
 *
 *   Ollama (selfhosted, sem chave):
 *     OLLAMA_BASE_URL  — URL do servidor (padrão: http://localhost:11434/v1)
 *
 *   OpenAI-compatible:
 *     OPENAI_API_KEY   — obrigatória
 *     OPENAI_BASE_URL  — base URL customizada (opcional)
 */
export function getAIModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER ?? "google") as SupportedProvider;

  switch (provider) {
    case "google": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY não definida. Configure no arquivo .env ou no ambiente.",
        );
      }
      const model = process.env.AI_MODEL ?? "gemini-2.0-flash";
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model) as LanguageModel;
    }

    case "ollama": {
      // Ollama expõe uma API compatível com OpenAI em /v1
      const baseURL =
        process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
      const model = process.env.AI_MODEL ?? "llama3.2";
      const ollama = createOpenAI({
        apiKey: "ollama", // Ollama não valida a chave, mas o campo é obrigatório
        baseURL,
      });
      return ollama(model) as LanguageModel;
    }

    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY não definida. Configure no arquivo .env ou no ambiente.",
        );
      }
      const baseURL = process.env.OPENAI_BASE_URL;
      const model = process.env.AI_MODEL ?? "gpt-4o-mini";
      const openai = createOpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
      });
      return openai(model) as LanguageModel;
    }

    default: {
      throw new Error(
        `Provider de IA desconhecido: "${provider}". Use "google", "ollama" ou "openai".`,
      );
    }
  }
}
