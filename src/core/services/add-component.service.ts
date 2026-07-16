import path from "node:path";
import type { IStorageClient } from "../interfaces/storage-client.interface.js";
import type { IFileSystemClient } from "../interfaces/file-system-client.interface.js";

export interface AddComponentInput {
  name: string;
  destinationDirAbsolutePath: string;
}

export interface MissingDependency {
  name: string;
  version: string;
}

export interface AddComponentResult {
  writtenFiles: string[];
  entryFileAbsolutePath: string;
  missingDependencies: MissingDependency[];
}

export class AddComponentService {
  constructor(
    private readonly storageClient: IStorageClient,
    private readonly fsClient: IFileSystemClient,
  ) {}

  async execute(input: AddComponentInput): Promise<AddComponentResult> {
    const { metadata, files } = await this.storageClient.loadComponent(input.name);

    // Se foi salvo como diretório (estratégia Folder), cria uma pasta com o nome
    // do componente dentro do destino. Caso contrário, escreve o(s) arquivo(s) direto ali.
    const baseDestDir = metadata.isDirectory
      ? path.join(input.destinationDirAbsolutePath, metadata.name)
      : input.destinationDirAbsolutePath;

    const writtenFiles: string[] = [];
    for (const file of files) {
      const dest = path.join(baseDestDir, file.relativePath);
      await this.fsClient.writeFile(dest, file.content);
      writtenFiles.push(dest);
    }

    const projectPkg = await this.fsClient.findNearestPackageJson(input.destinationDirAbsolutePath);
    const missingDependencies: MissingDependency[] = [];

    for (const [depName, version] of Object.entries(metadata.externalDependencies)) {
      const alreadyPresent =
        !!projectPkg && (depName in projectPkg.dependencies || depName in projectPkg.devDependencies);
      if (!alreadyPresent) {
        missingDependencies.push({ name: depName, version });
      }
    }

    return {
      writtenFiles,
      entryFileAbsolutePath: path.join(baseDestDir, metadata.entryFile),
      missingDependencies,
    };
  }
}
