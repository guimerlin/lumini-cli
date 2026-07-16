/**
 * Representa uma importação encontrada dentro de um arquivo, já classificada
 * quanto à sua origem (local ao projeto vs. pacote externo do NPM).
 */
export interface ImportInfo {
  /** O texto exatamente como aparece no `from '...'` do código original. */
  source: string;
  /** true se a importação começa com "." ou "/" (arquivo local do projeto). */
  isRelative: boolean;
  /** Caminho absoluto resolvido no disco, quando `isRelative` é true. */
  resolvedPath?: string;
  /** Nomes importados (para fins de metadado/depuração). */
  specifiers: string[];
}

/**
 * Representa um único arquivo já lido e analisado, parte da árvore de um componente.
 */
export interface ComponentNode {
  /** Caminho absoluto do arquivo no disco de origem. */
  absolutePath: string;
  /** Caminho relativo à raiz do alvo (arquivo ou pasta) que está sendo salvo. */
  relativePath: string;
  /** Conteúdo bruto do arquivo (pode ser reescrito pela estratégia, ex: Folder). */
  content: string;
  /** Importações identificadas neste arquivo. */
  imports: ImportInfo[];
  /** Se este é o arquivo apontado diretamente pelo usuário no comando `save`. */
  isEntry: boolean;
}
