import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type {
  IStorageClient,
  LoadedComponent,
  StoredFile,
} from "../../core/interfaces/storage-client.interface.js";
import type { ComponentMetadata } from "../../core/entities/metadata.entity.js";

const LIBRARY_ROOT = path.join(os.homedir(), ".lumini", "library");
const METADATA_FILENAME = "lumini.metadata.json";

export class StorageClient implements IStorageClient {
  private componentDir(name: string): string {
    return path.join(LIBRARY_ROOT, name);
  }

  async saveComponent(metadata: ComponentMetadata, files: StoredFile[]): Promise<void> {
    const dir = this.componentDir(metadata.name);
    await fs.ensureDir(dir);

    for (const file of files) {
      const dest = path.join(dir, file.relativePath);
      await fs.ensureDir(path.dirname(dest));
      await fs.writeFile(dest, file.content, "utf-8");
    }

    await fs.writeJson(path.join(dir, METADATA_FILENAME), metadata, { spaces: 2 });
  }

  async loadComponent(name: string): Promise<LoadedComponent> {
    const dir = this.componentDir(name);
    const metadataPath = path.join(dir, METADATA_FILENAME);

    if (!(await fs.pathExists(metadataPath))) {
      throw new Error(
        `Componente "${name}" não encontrado na biblioteca. Rode "lumini list" para ver os disponíveis.`,
      );
    }

    const metadata: ComponentMetadata = await fs.readJson(metadataPath);
    const files: StoredFile[] = [];

    for (const relativePath of metadata.files) {
      const content = await fs.readFile(path.join(dir, relativePath), "utf-8");
      files.push({ relativePath, content });
    }

    return { metadata, files };
  }

  async exists(name: string): Promise<boolean> {
    return fs.pathExists(path.join(this.componentDir(name), METADATA_FILENAME));
  }

  async list(): Promise<ComponentMetadata[]> {
    await fs.ensureDir(LIBRARY_ROOT);
    const entries = await fs.readdir(LIBRARY_ROOT, { withFileTypes: true });
    const results: ComponentMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metadataPath = path.join(LIBRARY_ROOT, entry.name, METADATA_FILENAME);
      if (await fs.pathExists(metadataPath)) {
        results.push(await fs.readJson(metadataPath));
      }
    }

    return results;
  }

  async remove(name: string): Promise<void> {
    await fs.remove(this.componentDir(name));
  }
}
