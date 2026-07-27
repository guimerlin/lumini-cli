import { generateText, Output } from "ai";
import { getAIModel } from "./ai-provider.js";
import { z } from "zod";
// ---------------------------------------------------------------------------
// Schema de saída estruturada
// ---------------------------------------------------------------------------
const ReleaseSchema = z.object({
    nextVersion: z
        .string()
        .describe("Próxima versão semântica (ex: 1.2.0)"),
    bumpType: z
        .enum(["major", "minor", "patch"])
        .describe("Tipo de incremento semântico determinado"),
    title: z
        .string()
        .describe("Título da release (ex: Release v1.2.0 — Nova feature de autenticação)"),
    summary: z
        .string()
        .describe("Resumo executivo das mudanças desta release em 2-3 frases"),
    changelog: z
        .string()
        .describe("Release Notes completo em formato Markdown, organizado por seção"),
    breakingChanges: z
        .array(z.string())
        .describe("Lista de breaking changes, vazia se não houver nenhum"),
    highlights: z
        .array(z.string())
        .describe("Lista de 3 a 5 destaques/features principais desta release"),
});
// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `\
Você é um Release Manager sênior especialista em versionamento semântico (SemVer) e documentação técnica.
Sua tarefa é analisar o diff do último commit de um repositório e preparar todos os artefatos da próxima release.

Regras de SemVer:
- MAJOR: Se houver "BREAKING CHANGE" na mensagem ou mudanças incompatíveis com versão anterior.
- MINOR: Se houver novas funcionalidades ("feat") sem breaking changes.
- PATCH: Se houver apenas correções ("fix"), refatorações, docs, chore ou tarefas de manutenção.

Formato do Changelog em Markdown:
## [x.y.z] - YYYY-MM-DD

### 🚀 Novas Funcionalidades
- ...

### 🐛 Correções de Bugs
- ...

### ♻️ Refatorações
- ...

### 📚 Documentação
- ...

### 🔧 Manutenção / Chore
- ...

### ⚠️ Breaking Changes
- ...

Omita seções que não tiverem itens.
Retorne SOMENTE um JSON válido, sem markdown fora do changelog, sem explicações extras.`;
function buildReleasePrompt(currentVersion, commitDiff, commitMessages, today) {
    const commitsBlock = commitMessages.length > 0
        ? commitMessages.map((m) => `  - ${m}`).join("\n")
        : "  (nenhuma mensagem de commit disponível)";
    return `\
Repositório Git — dados para a próxima release:

## Versão Atual
${currentVersion}

## Data de Hoje
${today}

## Mensagens dos Commits desde a Última Tag
${commitsBlock}

## Diff do Último Commit
\`\`\`diff
${commitDiff || "(sem diff disponível)"}
\`\`\`

Com base nessas informações:
1. Determine o tipo de bump semântico (major | minor | patch).
2. Calcule a próxima versão aplicando o bump à versão atual.
3. Gere o changelog completo em Markdown.
4. Preencha todos os campos do JSON de saída.`;
}
// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------
export async function generateRelease(currentVersion, commitDiff, commitMessages) {
    const model = getAIModel();
    const today = new Date().toISOString().split("T")[0];
    console.log("🤖 Lumini acionando o agente de release...");
    const userMessage = buildReleasePrompt(currentVersion, commitDiff, commitMessages, today);
    const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: userMessage,
        output: Output.object({ schema: ReleaseSchema }),
    });
    try {
        return JSON.parse(text.trim());
    }
    catch {
        throw new Error(`A IA retornou uma resposta que não é JSON válido:\n${text}`);
    }
}
