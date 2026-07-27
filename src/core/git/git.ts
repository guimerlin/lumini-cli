import { execSync, ExecSyncOptions } from "node:child_process";

export interface GitFileStatus {
  path: string;
  indexStatus: string;
  workingTreeStatus: string;
  isStaged: boolean;
  isUntracked: boolean;
}

export interface GitDiffResult {
  stagedDiff: string;
  unstagedDiff: string;
  hasChanges: boolean;
}

/**
 * Executa um comando Git nativo e retorna o stdout limpo.
 */
export function runGit(command: string, options?: ExecSyncOptions): string {
  try {
    return (execSync(`git ${command}`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    }) as string).trim();
  } catch (error: any) {
    const stderr = error.stderr ? error.stderr.toString() : error.message;
    throw new Error(`Erro ao executar comando Git "git ${command}": ${stderr}`);
  }
}

/**
 * Verifica se o diretório atual é um repositório Git válido.
 */
export function isGitRepository(): boolean {
  try {
    runGit("rev-parse --is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtém a lista detalhada de arquivos modificados e seus respectivos status.
 */
export function getGitStatus(): GitFileStatus[] {
  if (!isGitRepository()) {
    throw new Error("O diretório atual não é um repositório Git.");
  }

  const rawStatus = runGit("status --porcelain=v1");
  if (!rawStatus) return [];

  const lines = rawStatus.split("\n");

  return lines.map((line) => {
    const indexStatus = line[0];
    const workingTreeStatus = line[1];
    const filePath = line.substring(3).trim();

    return {
      path: filePath,
      indexStatus,
      workingTreeStatus,
      isStaged: indexStatus !== " " && indexStatus !== "?",
      isUntracked: indexStatus === "?" && workingTreeStatus === "?",
    };
  });
}

/**
 * Captura os diffs do repositório (tanto staged quanto unstaged).
 */
export function getGitDiff(): GitDiffResult {
  const stagedDiff = runGit("diff --staged");
  const unstagedDiff = runGit("diff");

  return {
    stagedDiff,
    unstagedDiff,
    hasChanges: Boolean(stagedDiff || unstagedDiff),
  };
}

/**
 * Adiciona arquivos específicos ao staging.
 */
export function stageFiles(files: string[]): void {
  if (files.length === 0) return;
  // Envolve os caminhos entre aspas para evitar problemas com espaços ou caracteres especiais
  const fileList = files.map((f) => `"${f}"`).join(" ");
  runGit(`add ${fileList}`);
}

/**
 * Realiza um commit com a mensagem especificada.
 */
export function createCommit(message: string): string {
  // Escapa aspas duplas na mensagem de commit
  const escapedMessage = message.replace(/"/g, '\\"');
  return runGit(`commit -m "${escapedMessage}"`);
}

/**
 * Salva o estado atual do repositório (HEAD + working directory) em um snapshot seguro de UNDO.
 * Utiliza o sistema de referências customizadas do Git (refs/lumini/undo).
 */
export function saveUndoSnapshot(): void {
  if (!isGitRepository()) return;

  try {
    const currentHead = runGit("rev-parse HEAD");
    runGit(`update-ref refs/lumini/undo ${currentHead}`);
  } catch {
    // Se for o commit inicial e não houver HEAD ainda, ignoramos a criação de ref de commit
  }
}

/**
 * Restaura o repositório para o estado do último Snapshot do Lumini CLI.
 */
export function restoreUndoSnapshot(): void {
  if (!isGitRepository()) {
    throw new Error("O diretório atual não é um repositório Git.");
  }

  try {
    const targetHead = runGit("rev-parse refs/lumini/undo");
    // Faz um soft reset para manter as alterações salvas em draft no working directory
    runGit(`reset --soft ${targetHead}`);
    console.log(
      "✔ Estado do repositório restaurado com sucesso! Os commits gerados foram desfeitos.",
    );
  } catch {
    throw new Error(
      "Nenhum ponto de restauração (undo) do Lumini foi encontrado para este repositório.",
    );
  }
}
