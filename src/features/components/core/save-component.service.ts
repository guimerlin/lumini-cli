import type { ISaveStrategy } from "../../../shared/core/interfaces/save-strategy.interface.js";
import type { IStorageClient } from "../../../shared/core/interfaces/storage-client.interface.js";
import type { IFileSystemClient } from "../../../shared/core/interfaces/file-system-client.interface.js";
import type { ComponentMetadata, SaveStrategy } from "../../../shared/core/entities/metadata.entity.js";
import path from "node:path";

export interface SaveComponentInput {
  name: string;
  targetAbsolutePath: string;
  strategy: SaveStrategy;
  tag?: string;
  structureOnly?: boolean;
  excludeFiles?: string[];
  associatedVault?: string;
}

export class SaveComponentService {
  constructor(
    private readonly strategies: Record<SaveStrategy, ISaveStrategy>,
    private readonly storageClient: IStorageClient,
    private readonly fsClient: IFileSystemClient,
  ) {}

  async execute(input: SaveComponentInput): Promise<ComponentMetadata> {
    if (input.structureOnly) {
      const isDir = await this.fsClient.isDirectory(input.targetAbsolutePath);
      if (!isDir) {
        throw new Error("Structure-only mode requires a directory target.");
      }

      const absoluteDirs = await this.fsClient.listDirectoriesRecursively(input.targetAbsolutePath);
      const relativeDirs = absoluteDirs.map((d) => path.relative(input.targetAbsolutePath, d));

      const metadata: ComponentMetadata = {
        name: input.name,
        strategy: input.strategy,
        createdAt: new Date().toISOString(),
        entryFile: "",
        isDirectory: true,
        externalDependencies: {},
        files: relativeDirs,
        sourcePath: input.targetAbsolutePath,
        tag: input.tag,
        structureOnly: true,
        associatedVault: input.associatedVault,
      };

      await this.storageClient.saveComponent(metadata, []);
      return metadata;
    }

    const strategyHandler = this.strategies[input.strategy];
    let result = await strategyHandler.resolve(input.targetAbsolutePath);

    if (input.excludeFiles && input.excludeFiles.length > 0) {
      result.files = result.files.filter((f) => !input.excludeFiles!.includes(f.relativePath));
    }

    const metadata: ComponentMetadata = {
      name: input.name,
      strategy: input.strategy,
      createdAt: new Date().toISOString(),
      entryFile: result.entryFile,
      isDirectory: result.isDirectory,
      externalDependencies: result.externalDependencies,
      files: result.files.map((f) => f.relativePath),
      sourcePath: input.targetAbsolutePath,
      tag: input.tag,
      structureOnly: false,
      associatedVault: input.associatedVault,
    };

    await this.storageClient.saveComponent(metadata, result.files);
    return metadata;
  }
}
