export interface PackageJsonInfo {
  path: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * Contrato para operações de disco. Se no futuro o Lumini precisar rodar
 * num ambiente sem acesso direto a `fs` (ex: dentro de um plugin de IDE),
 * basta trocar a implementação em infrastructure/clients.
 */
export interface IFileSystemClient {
  readFile(absolutePath: string): Promise<string>;
  writeFile(absolutePath: string, content: string): Promise<void>;
  ensureDir(absolutePath: string): Promise<void>;
  exists(absolutePath: string): Promise<boolean>;
  isDirectory(absolutePath: string): Promise<boolean>;
  listFilesRecursively(absoluteDirPath: string, extensions: string[]): Promise<string[]>;

  /**
   * Tenta resolver um "from" de import (ex: "./Button" ou "../hooks/useAuth")
   * para um arquivo real no disco, testando extensões (.ts, .tsx, .js, .jsx)
   * e variações de index (ex: "./Button/index.tsx").
   */
  resolveImportToFile(fromFileAbsolutePath: string, importSource: string): Promise<string | null>;

  /** Sobe os diretórios a partir de um arquivo até achar o package.json mais próximo do projeto. */
  findNearestPackageJson(fromAbsolutePath: string): Promise<PackageJsonInfo | null>;
}
