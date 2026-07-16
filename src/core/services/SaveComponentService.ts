import path from 'path';
import type { IStorageClient } from '../interfaces/IStorageClient.js';
import type { IAstParser } from '../interfaces/IAstParser.js';
import type { ComponentMetadata } from '../entities/Metadata.js';

interface SaveComponentOptions {
  componentPath: string;
  componentName: string;
  strategy: 'raw' | 'deps' | 'bundle' | 'folder';
}

export class SaveComponentService {
  constructor(
    private readonly storageClient: IStorageClient,
    private readonly astParser: IAstParser
  ) {}

  async execute(options: SaveComponentOptions): Promise<void> {
    const { componentPath, componentName, strategy } = options;

    if (!(await this.storageClient.exists(componentPath))) {
      throw new Error(`File or directory not found at ${componentPath}`);
    }

    const libraryPath = this.storageClient.getGlobalLibraryPath();
    const targetDir = path.join(libraryPath, componentName);

    // Create the target directory
    await this.storageClient.createDir(targetDir);

    const metadata: ComponentMetadata = {
      name: componentName,
      originalPath: componentPath,
      strategy,
      dependencies: {},
      files: [],
      createdAt: new Date().toISOString(),
    };

    const isFile = componentPath.endsWith('.ts') || componentPath.endsWith('.tsx') || componentPath.endsWith('.js') || componentPath.endsWith('.jsx'); // naive check for now, can use fs.stat later

    if (strategy === 'raw') {
      const fileName = path.basename(componentPath);
      const destPath = path.join(targetDir, fileName);
      await this.storageClient.copyFile(componentPath, destPath);
      metadata.files.push(fileName);
    } else if (strategy === 'deps') {
      const fileName = path.basename(componentPath);
      const destPath = path.join(targetDir, fileName);
      const content = await this.storageClient.readFile(componentPath);
      const imports = await this.astParser.parseImports(content, componentPath);

      await this.storageClient.writeFile(destPath, content);
      metadata.files.push(fileName);

      // we'd fetch actual versions from project's package.json here ideally
      imports.external.forEach(dep => {
        metadata.dependencies[dep] = 'latest';
      });
    } else if (strategy === 'folder' || strategy === 'bundle') {
       // Simplified logic for folder and bundle, just copy everything for now
       // In a real implementation we would trace the local imports and bundle/copy them
       if (isFile) {
         const fileName = path.basename(componentPath);
         const destPath = path.join(targetDir, fileName);
         await this.storageClient.copyFile(componentPath, destPath);
         metadata.files.push(fileName);
       } else {
         const folderName = path.basename(componentPath);
         const destPath = path.join(targetDir, folderName);
         await this.storageClient.copyDir(componentPath, destPath);
         metadata.files.push(folderName);
       }
    }

    // Save metadata
    await this.storageClient.writeFile(
      path.join(targetDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }
}
