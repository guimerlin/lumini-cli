import path from "node:path";
import type { IStorageClient } from "../interfaces/storage-client.interface.js";
import type { IFileSystemClient } from "../interfaces/file-system-client.interface.js";
import type { ComponentMetadata } from "../entities/metadata.entity.js";

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
  metadata: ComponentMetadata;
}

export class AddComponentService {
  constructor(
    private readonly storageClient: IStorageClient,
    private readonly fsClient: IFileSystemClient,
  ) {}

  async execute(input: AddComponentInput): Promise<AddComponentResult> {
    const { metadata, files } = await this.storageClient.loadComponent(input.name);

    const baseDestDir = metadata.isDirectory
      ? path.join(input.destinationDirAbsolutePath, metadata.name)
      : input.destinationDirAbsolutePath;

    if (metadata.structureOnly) {
      await this.fsClient.ensureDir(baseDestDir);
      for (const relDir of metadata.files) {
        await this.fsClient.ensureDir(path.join(baseDestDir, relDir));
      }
      return {
        writtenFiles: [],
        entryFileAbsolutePath: "",
        missingDependencies: [],
        metadata,
      };
    }

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
      metadata,
    };
  }
}
