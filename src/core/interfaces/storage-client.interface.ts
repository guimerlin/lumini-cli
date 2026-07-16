import type { ComponentMetadata } from "../entities/metadata.entity.js";

export interface StoredFile {
  /** Caminho relativo dentro da pasta do componente na biblioteca. */
  relativePath: string;
  content: string;
}

export interface LoadedComponent {
  metadata: ComponentMetadata;
  files: StoredFile[];
}

/**
 * Contrato de persistência da biblioteca de componentes do usuário.
 * Implementação padrão grava em disco (~/.lumini/library). Se no futuro
 * o armazenamento migrar para S3/remoto, só esta implementação muda.
 */
export interface IStorageClient {
  saveComponent(metadata: ComponentMetadata, files: StoredFile[]): Promise<void>;
  loadComponent(name: string): Promise<LoadedComponent>;
  exists(name: string): Promise<boolean>;
  list(): Promise<ComponentMetadata[]>;
  remove(name: string): Promise<void>;
}
