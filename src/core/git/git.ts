import { execSync, ExecSyncOptions } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

  const lines = rawStatus.split("\n").filter(Boolean);

  return lines
    .map((line) => {
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
    })
    .filter((f) => {
      // Remove arquivos que são gitignored (ex: dist/ que pode estar trackeado)
      const ignoredPaths = filterIgnoredFiles([f.path]);
      return ignoredPaths.length > 0;
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
 * Filtra uma lista de caminhos removendo os que são ignorados pelo .gitignore.
 */
export function filterIgnoredFiles(files: string[]): string[] {
  if (files.length === 0) return [];
  try {
    // git check-ignore lê paths via stdin com --stdin e retorna apenas os ignorados
    const input = files.join("\n");
    const ignored = execSync("git check-ignore --stdin", {
      encoding: "utf-8",
      input,
      stdio: ["pipe", "pipe", "pipe"],
    }) as string;
    const ignoredSet = new Set(ignored.trim().split("\n").filter(Boolean));
    return files.filter((f) => !ignoredSet.has(f));
  } catch {
    // Se não há nenhum arquivo ignorado, git check-ignore retorna exit code 1
    // Nesse caso retornamos todos os arquivos originais
    return files;
  }
}

/**
 * Adiciona arquivos específicos ao staging, ignorando silenciosamente arquivos gitignored.
 */
export function stageFiles(files: string[]): void {
  if (files.length === 0) return;
  const validFiles = filterIgnoredFiles(files);
  if (validFiles.length === 0) return;
  const fileList = validFiles.map((f) => `"${f}"`).join(" ");
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

// ---------------------------------------------------------------------------
// Release helpers
// ---------------------------------------------------------------------------

/**
 * Retorna o nome da última tag Git (ex: v1.2.3), ou null se não houver.
 */
export function getLastTag(): string | null {
  try {
    return runGit("describe --tags --abbrev=0");
  } catch {
    return null;
  }
}

/**
 * Retorna a lista de mensagens de commit desde a última tag.
 * Se não houver tag anterior, retorna todos os commits.
 */
export function getCommitsSinceTag(tag: string | null): string[] {
  try {
    const range = tag ? `${tag}..HEAD` : "HEAD";
    const log = runGit(`log ${range} --oneline --no-merges`);
    if (!log) return [];
    return log.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Retorna o diff do último commit (HEAD vs HEAD~1).
 * Se só existir um commit, retorna o diff completo do commit inicial.
 */
export function getLastCommitDiff(): string {
  try {
    // Verifica se há mais de um commit
    const count = runGit("rev-list --count HEAD");
    if (parseInt(count, 10) <= 1) {
      return runGit("diff --stat HEAD");
    }
    return runGit("diff HEAD~1 HEAD");
  } catch {
    return "";
  }
}

/**
 * Lê a versão atual do package.json. Caso não exista, tenta a última tag Git.
 * Fallback final: "0.0.0".
 */
export function getCurrentVersion(cwd: string = process.cwd()): string {
  // 1. Tenta package.json
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      // ignora erros de parse
    }
  }

  // 2. Tenta última tag Git (remove o 'v' prefixo se houver)
  const lastTag = getLastTag();
  if (lastTag) {
    return lastTag.replace(/^v/, "");
  }

  // 3. Fallback
  return "0.0.0";
}

/**
 * Cria uma tag Git anotada.
 */
export function createTag(version: string, message: string): void {
  const tag = version.startsWith("v") ? version : `v${version}`;
  const escapedMsg = message.replace(/"/g, '\\"');
  runGit(`tag -a ${tag} -m "${escapedMsg}"`);
}

/**
 * Incrementa a versão conforme o tipo de bump.
 */
export function bumpVersion(
  currentVersion: string,
  bump: "major" | "minor" | "patch",
): string {
  const clean = currentVersion.replace(/^v/, "");
  const parts = clean.split(".").map(Number);
  let [major, minor, patch] = parts.length === 3 ? parts : [0, 0, 0];

  switch (bump) {
    case "major":
      major++;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor++;
      patch = 0;
      break;
    case "patch":
      patch++;
      break;
  }

  return `${major}.${minor}.${patch}`;
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
