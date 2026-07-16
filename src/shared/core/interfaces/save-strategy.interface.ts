import type { SaveStrategy } from "../entities/metadata.entity.js";
import type { StoredFile } from "./storage-client.interface.js";

export interface StrategyResult {
  /** Arquivos finais que serão persistidos na biblioteca. */
  files: StoredFile[];
  /** Caminho (relativo aos `files`) do arquivo de entrada. */
  entryFile: string;
  /** true se o resultado deve ser tratado como diretório ao reidratar via `add`. */
  isDirectory: boolean;
  /** Dependências externas (NPM) coletadas de todos os arquivos analisados. */
  externalDependencies: Record<string, string>;
}

/**
 * Cada estratégia recebe o caminho absoluto do alvo (arquivo ou pasta) e
 * decide como resolver as importações locais encontradas.
 */
export interface ISaveStrategy {
  readonly name: SaveStrategy;
  resolve(targetAbsolutePath: string): Promise<StrategyResult>;
}
