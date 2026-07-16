export interface IStorageClient {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createDir(path: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  copyDir(src: string, dest: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getGlobalLibraryPath(): string;
  readDir(path: string): Promise<string[]>;
}
