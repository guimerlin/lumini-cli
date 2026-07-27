import { ExecSyncOptions } from "node:child_process";
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
export declare function runGit(command: string, options?: ExecSyncOptions): string;
/**
 * Verifica se o diretório atual é um repositório Git válido.
 */
export declare function isGitRepository(): boolean;
/**
 * Obtém a lista detalhada de arquivos modificados e seus respectivos status.
 */
export declare function getGitStatus(): GitFileStatus[];
/**
 * Captura os diffs do repositório (tanto staged quanto unstaged).
 */
export declare function getGitDiff(): GitDiffResult;
/**
 * Filtra uma lista de caminhos removendo os que são ignorados pelo .gitignore.
 */
export declare function filterIgnoredFiles(files: string[]): string[];
/**
 * Adiciona arquivos específicos ao staging, ignorando silenciosamente arquivos gitignored.
 */
export declare function stageFiles(files: string[]): void;
/**
 * Realiza um commit com a mensagem especificada.
 */
export declare function createCommit(message: string): string;
/**
 * Salva o estado atual do repositório (HEAD + working directory) em um snapshot seguro de UNDO.
 * Utiliza o sistema de referências customizadas do Git (refs/lumini/undo).
 */
export declare function saveUndoSnapshot(): void;
/**
 * Retorna o nome da última tag Git (ex: v1.2.3), ou null se não houver.
 */
export declare function getLastTag(): string | null;
/**
 * Retorna a lista de mensagens de commit desde a última tag.
 * Se não houver tag anterior, retorna todos os commits.
 */
export declare function getCommitsSinceTag(tag: string | null): string[];
/**
 * Retorna o diff do último commit (HEAD vs HEAD~1).
 * Se só existir um commit, retorna o diff completo do commit inicial.
 */
export declare function getLastCommitDiff(): string;
/**
 * Lê a versão atual do package.json. Caso não exista, tenta a última tag Git.
 * Fallback final: "0.0.0".
 */
export declare function getCurrentVersion(cwd?: string): string;
/**
 * Cria uma tag Git anotada.
 */
export declare function createTag(version: string, message: string): void;
/**
 * Incrementa a versão conforme o tipo de bump.
 */
export declare function bumpVersion(currentVersion: string, bump: "major" | "minor" | "patch"): string;
/**
 * Restaura o repositório para o estado do último Snapshot do Lumini CLI.
 */
export declare function restoreUndoSnapshot(): void;
