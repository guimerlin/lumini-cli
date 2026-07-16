export type SaveStrategy = "raw" | "deps" | "bundle" | "folder";

/**
 * Manifesto persistido ao lado do(s) arquivo(s) salvos na biblioteca do Lumini.
 * É consultado pelo comando `add` para saber como reidratar o componente
 * em um novo projeto (quais arquivos copiar, quais deps externas garantir).
 */
export interface ComponentMetadata {
  /** Nome/identificador único do componente na biblioteca (ex: "Button", "useAuth"). */
  name: string;
  /** Estratégia usada no momento do save. */
  strategy: SaveStrategy;
  /** ISO timestamp de criação. */
  createdAt: string;
  /** Caminho (relativo à raiz salva) do arquivo que deve ser importado como entrada. */
  entryFile: string;
  /** true quando o componente foi salvo como estrutura de diretório (Folder/Bundle de pasta). */
  isDirectory: boolean;
  /** Dependências externas (NPM) necessárias, com versão sugerida (a do projeto de origem, se disponível). */
  externalDependencies: Record<string, string>;
  /** Lista de todos os arquivos que compõem o componente salvo (relativos à raiz do componente). */
  files: string[];
  /** Origem: caminho absoluto original no projeto onde foi feito o `save` (referência/depuração). */
  sourcePath: string;
  /** Tag de organização do componente (padrão: _general) */
  tag?: string;
  /** Se true, o componente salva apenas a estrutura de diretórios */
  structureOnly?: boolean;
  /** Nome do Vault associado a este componente (caso tenha arquivos .env) */
  associatedVault?: string;
}
