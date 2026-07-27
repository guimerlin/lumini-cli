import { generateText } from "ai";
import { getAIModel } from "./ai-provider.js";
import type { GitDiffResult, GitFileStatus } from "./git.js";

const SYSTEM_PROMPT = `\
Você é um especialista em Git e revisão de código.
Sua tarefa é analisar as alterações de um repositório Git e agrupá-las em commits \
semânticos coesos, seguindo o padrão Conventional Commits.

Retorne SOMENTE um JSON válido, sem markdown, sem explicações, no formato:
{
  "groups": [
    {
      "type": "feat | fix | docs | style | refactor | test | chore",
      "scope": "nome do módulo afetado (opcional)",
      "message": "mensagem do commit em inglês no imperativo",
      "files": ["lista", "de", "arquivos"]
    }
  ]
}`;

/**
 * Analisa o status e diff do repositório e agrupa os arquivos em commits
 * semânticos usando o modelo de IA configurado via variáveis de ambiente.
 */
export async function analyzeAndGroupCommits(
  status: GitFileStatus[],
  diff: GitDiffResult,
): Promise<{ groups: CommitGroup[] }> {
  const model = getAIModel();

  const userMessage = buildPrompt(status, diff);

  console.log("🤖 Lumini acionando o agente de IA...");

  const { text } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: userMessage,
  });

  try {
    return JSON.parse(text.trim()) as { groups: CommitGroup[] };
  } catch {
    throw new Error(
      `A IA retornou uma resposta que não é JSON válido:\n${text}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CommitGroup {
  type: string;
  scope?: string;
  message: string;
  files: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrompt(status: GitFileStatus[], diff: GitDiffResult): string {
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
