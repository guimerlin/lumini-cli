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
  private parseFullName(fullName: string): { tag: string; name: string } {
    if (fullName.startsWith("@")) {
      const parts = fullName.slice(1).split("/");
      if (parts.length >= 2) {
        const tag = parts[0] as string;
        const name = parts.slice(1).join("/");
        return { tag, name };
      }
    }
    return { tag: "_general", name: fullName };
  }

  private componentDir(fullName: string, tag?: string): string {
    const parsed = this.parseFullName(fullName);
    const cleanTag = tag || parsed.tag;
    return path.join(LIBRARY_ROOT, cleanTag, parsed.name);
  }

  async saveComponent(metadata: ComponentMetadata, files: StoredFile[]): Promise<void> {
    const dir = this.componentDir(metadata.name, metadata.tag);
    await fs.ensureDir(dir);

    for (const file of files) {
      const dest = path.join(dir, file.relativePath);
      await fs.ensureDir(path.dirname(dest));
      await fs.writeFile(dest, file.content, "utf-8");
    }

    await fs.writeJson(path.join(dir, METADATA_FILENAME), metadata, { spaces: 2 });
  }

  async loadComponent(name: string): Promise<LoadedComponent> {
    let dir = this.componentDir(name);
    let metadataPath = path.join(dir, METADATA_FILENAME);

    if (!(await fs.pathExists(metadataPath))) {
      // Legacy fallback
      const parsed = this.parseFullName(name);
      if (parsed.tag === "_general") {
        const legacyDir = path.join(LIBRARY_ROOT, parsed.name);
        const legacyMetadataPath = path.join(legacyDir, METADATA_FILENAME);
        if (await fs.pathExists(legacyMetadataPath)) {
          dir = legacyDir;
          metadataPath = legacyMetadataPath;
        }
      }
    }

    if (!(await fs.pathExists(metadataPath))) {
      throw new Error(
        `Component "${name}" not found in the library. Run "lumini list" to see available components.`,
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
    const dir = this.componentDir(name);
    if (await fs.pathExists(path.join(dir, METADATA_FILENAME))) {
      return true;
    }
    const parsed = this.parseFullName(name);
    if (parsed.tag === "_general") {
      const legacyDir = path.join(LIBRARY_ROOT, parsed.name);
      if (await fs.pathExists(path.join(legacyDir, METADATA_FILENAME))) {
        return true;
      }
    }
    return false;
  }

  async list(): Promise<ComponentMetadata[]> {
    await fs.ensureDir(LIBRARY_ROOT);
    const entries = await fs.readdir(LIBRARY_ROOT, { withFileTypes: true });
    const results: ComponentMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const entryPath = path.join(LIBRARY_ROOT, entry.name);
      const directMetadataPath = path.join(entryPath, METADATA_FILENAME);

      if (await fs.pathExists(directMetadataPath)) {
        const metadata: ComponentMetadata = await fs.readJson(directMetadataPath);
        if (!metadata.tag) {
          metadata.tag = "_general";
        }
        results.push(metadata);
      } else {
        const comps = await fs.readdir(entryPath, { withFileTypes: true });
        for (const comp of comps) {
          if (!comp.isDirectory()) continue;
          const metadataPath = path.join(entryPath, comp.name, METADATA_FILENAME);
          if (await fs.pathExists(metadataPath)) {
            const metadata: ComponentMetadata = await fs.readJson(metadataPath);
            if (!metadata.tag) {
              metadata.tag = entry.name;
            }
            results.push(metadata);
          }
        }
      }
    }

    return results;
  }

  async remove(name: string): Promise<void> {
    let dir = this.componentDir(name);
    if (await fs.pathExists(dir)) {
      await fs.remove(dir);
      return;
    }
    const parsed = this.parseFullName(name);
    if (parsed.tag === "_general") {
      const legacyDir = path.join(LIBRARY_ROOT, parsed.name);
      if (await fs.pathExists(legacyDir)) {
        await fs.remove(legacyDir);
      }
    }
  }
}
