import path from 'path';
import type { IStorageClient } from '../interfaces/IStorageClient.js';
import type { ComponentMetadata } from '../entities/Metadata.js';

interface AddComponentOptions {
  componentName: string;
  targetPath: string; // the directory to add the component to
}

export class AddComponentService {
  constructor(private readonly storageClient: IStorageClient) {}

  async execute(options: AddComponentOptions): Promise<void> {
    const { componentName, targetPath } = options;
    const libraryPath = this.storageClient.getGlobalLibraryPath();
    const sourceDir = path.join(libraryPath, componentName);

    if (!(await this.storageClient.exists(sourceDir))) {
      throw new Error(`Component '${componentName}' not found in global library.`);
    }

    const metadataPath = path.join(sourceDir, 'metadata.json');
    if (!(await this.storageClient.exists(metadataPath))) {
      throw new Error(`Metadata not found for component '${componentName}'.`);
    }

    const metadataContent = await this.storageClient.readFile(metadataPath);
    const metadata = JSON.parse(metadataContent) as ComponentMetadata;

    await this.storageClient.createDir(targetPath);

    for (const file of metadata.files) {
      const srcFilePath = path.join(sourceDir, file);
      const destFilePath = path.join(targetPath, file);
      // In a real implementation we would distinguish file and folder copies
      try {
        await this.storageClient.copyDir(srcFilePath, destFilePath);
      } catch {
        await this.storageClient.copyFile(srcFilePath, destFilePath);
      }
    }
  }
}
