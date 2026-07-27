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
 * Adiciona arquivos específicos ao staging.
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
 * Restaura o repositório para o estado do último Snapshot do Lumini CLI.
 */
export declare function restoreUndoSnapshot(): void;
