import { generateText, Output } from "ai";
import { getAIModel } from "./ai-provider.js";
import { z } from "zod";
const SYSTEM_PROMPT = `\
Você é um especialista em Git e revisão de código.
Sua tarefa é analisar alterações e gerar as respostas na estrutura em que forem pedidas.

Retorne SOMENTE um JSON válido, sem markdown, sem explicações.`;
export async function analyzeAndGroupCommits(status, diff) {
    const model = getAIModel();
    const userMessage = buildPrompt(status, diff);
    console.log("🤖 Lumini acionando o agente de IA...");
    const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: userMessage,
        output: Output.object({
            schema: z.object({
                commits: z.array(z.object({
                    scope: z
                        .string()
                        .describe("O módulo ou área afetada (ex: auth, ui, database, config). Pode ser vazio se for global."),
                    type: z
                        .enum([
                        "feat",
                        "fix",
                        "chore",
                        "refactor",
                        "docs",
                        "style",
                        "test",
                        "perf",
                        "ci",
                    ])
                        .describe("O tipo de alteração no padrão Conventional Commits."),
                    files: z
                        .array(z.string())
                        .describe("Lista contendo os caminhos exatos dos arquivos pertencentes a este commit."),
                    message: z
                        .string()
                        .describe("A mensagem descritiva do commit no formato: tipo(escopo): descrição."),
                })),
            }),
        }),
    });
    try {
        return JSON.parse(text.trim());
    }
    catch {
        throw new Error(`A IA retornou uma resposta que não é JSON válido:\n${text}`);
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildPrompt(status, diff) {
    const fileList = status
        .map((f) => `  ${f.indexStatus}${f.workingTreeStatus} ${f.path}`)
        .join("\n");
    const diffSummary = [
        diff.stagedDiff ? `=== STAGED DIFF ===\n${diff.stagedDiff}` : "",
        diff.unstagedDiff ? `=== UNSTAGED DIFF ===\n${diff.unstagedDiff}` : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    return `\
Repositório Git com as seguintes alterações:

## Status dos arquivos
\`\`\`
${fileList || "(nenhum arquivo modificado)"}
\`\`\`

## Diff
\`\`\`diff
${diffSummary || "(sem diff disponível)"}
\`\`\`

Agrupe essas alterações em commits semânticos coesos.`;
}
