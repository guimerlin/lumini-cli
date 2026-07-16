import type { ISaveStrategy } from "../interfaces/save-strategy.interface.js";
import type { IStorageClient } from "../interfaces/storage-client.interface.js";
import type { ComponentMetadata, SaveStrategy } from "../entities/metadata.entity.js";

export interface SaveComponentInput {
  name: string;
  targetAbsolutePath: string;
  strategy: SaveStrategy;
}

export class SaveComponentService {
  constructor(
    private readonly strategies: Record<SaveStrategy, ISaveStrategy>,
    private readonly storageClient: IStorageClient,
  ) {}

  async execute(input: SaveComponentInput): Promise<ComponentMetadata> {
    const strategyHandler = this.strategies[input.strategy];
    const result = await strategyHandler.resolve(input.targetAbsolutePath);

    const metadata: ComponentMetadata = {
      name: input.name,
      strategy: input.strategy,
      createdAt: new Date().toISOString(),
      entryFile: result.entryFile,
      isDirectory: result.isDirectory,
      externalDependencies: result.externalDependencies,
      files: result.files.map((f) => f.relativePath),
      sourcePath: input.targetAbsolutePath,
    };

    await this.storageClient.saveComponent(metadata, result.files);
    return metadata;
  }
}
