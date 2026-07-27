import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GitDiffResult, GitFileStatus } from "./git.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function analyzeAndGroupCommits(
  status: GitFileStatus[],
  diff: GitDiffResult,
) {
  const pythonScript = join(__dirname, "antigravity_worker.py");

  // Prepara os dados do repositório para enviar ao Python
  const payload = JSON.stringify({ status, diff });

  console.log("🤖 Lumini acionando o agente Antigravity via Python...");

  // Executa o script Python de forma síncrona
  const result = spawnSync("python3", [pythonScript], {
    input: payload,
    encoding: "utf-8",
    // Repassa os erros do Python para o terminal do Node caso algo dê errado
    stdio: ["pipe", "pipe", "inherit"],
  });

  if (result.error) {
    throw new Error(
      `Falha ao iniciar o worker Python: ${result.error.message}`,
    );
  }

  // Faz o parse do output retornado pelo SDK Python
  try {
    return JSON.parse(result.stdout.trim());
  } catch (err) {
    throw new Error("A resposta do Antigravity não retornou um JSON válido.");
  }
}
