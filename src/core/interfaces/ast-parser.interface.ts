import type { ImportInfo } from "../entities/component-node.entity.js";

export interface ParsedFile {
  code: string;
  imports: ImportInfo[];
}

/**
 * Contrato para leitura/manipulação da Árvore de Sintaxe Abstrata.
 * A implementação real (Babel, TS Compiler API, etc.) vive em infrastructure/parsers.
 */
export interface IAstParser {
  /** Lê o arquivo do disco e retorna seu código + lista de importações identificadas. */
  parseFile(absolutePath: string): Promise<ParsedFile>;

  /**
   * Reescreve, dentro do código fornecido, a origem de um import/export
   * específico (ex: trocar "../utils/format" por "./format").
   * Usado pela estratégia Folder para remapear caminhos após mover arquivos.
   */
  rewriteImportSource(code: string, oldSource: string, newSource: string): string;

  /**
   * Remove por completo as declarações de import/export cuja origem seja local
   * (usado pela estratégia Bundle, que injeta o código diretamente no arquivo).
   */
  stripImportsBySource(code: string, sources: string[]): string;
}
