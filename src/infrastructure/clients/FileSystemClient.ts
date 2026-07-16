import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { IStorageClient } from '../../core/interfaces/IStorageClient.js';

export class FileSystemClient implements IStorageClient {
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async createDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
  }

  async copyDir(src: string, dest: string): Promise<void> {
    await fs.cp(src, dest, { recursive: true });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getGlobalLibraryPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.lumini');
  }

  async readDir(dirPath: string): Promise<string[]> {
    return await fs.readdir(dirPath);
  }
}
