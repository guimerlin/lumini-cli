import path from "node:path";
import type { IFileSystemClient } from "../interfaces/file-system-client.interface.js";

export interface LuminiConfig {
  defaultImportPath?: string;
  defaultSaveStrategy?: string;
  defaultTag?: string;
  importedComponents?: Record<
    string,
    {
      tag?: string;
      files: string[];
      importedAt: string;
    }
  >;
}

export class ConfigService {
  private readonly configPath: string;

  constructor(private readonly fsClient: IFileSystemClient) {
    this.configPath = path.join(process.cwd(), ".lumini");
  }

  async exists(): Promise<boolean> {
    return this.fsClient.exists(this.configPath);
  }

  async read(): Promise<LuminiConfig> {
    if (!(await this.exists())) {
      return {};
    }
    try {
      const content = await this.fsClient.readFile(this.configPath);
      return JSON.parse(content) as LuminiConfig;
    } catch {
      return {};
    }
  }

  async write(config: LuminiConfig): Promise<void> {
    await this.fsClient.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  async registerImport(name: string, tag: string | undefined, files: string[]): Promise<void> {
    const config = await this.read();
    config.importedComponents = config.importedComponents ?? {};
    config.importedComponents[name] = {
      tag,
      files: files.map((f) => path.relative(process.cwd(), f)),
      importedAt: new Date().toISOString(),
    };
    await this.write(config);
  }
}
