import type { LanguageModel } from "ai";
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
export declare function getAIModel(): LanguageModel;
