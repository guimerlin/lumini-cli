import path from "node:path";
import fs from "fs-extra";
import type {
  IFileSystemClient,
  PackageJsonInfo,
} from "../../core/interfaces/file-system-client.interface.js";

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

export class FileSystemClient implements IFileSystemClient {
  async readFile(absolutePath: string): Promise<string> {
    return fs.readFile(absolutePath, "utf-8");
  }

  async writeFile(absolutePath: string, content: string): Promise<void> {
    await fs.ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, content, "utf-8");
  }

  async ensureDir(absolutePath: string): Promise<void> {
    await fs.ensureDir(absolutePath);
  }

  async exists(absolutePath: string): Promise<boolean> {
    return fs.pathExists(absolutePath);
  }

  async isDirectory(absolutePath: string): Promise<boolean> {
    const stat = await fs.stat(absolutePath);
    return stat.isDirectory();
  }

  async listFilesRecursively(absoluteDirPath: string, extensions: string[]): Promise<string[]> {
    const results: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (extensions.includes(path.extname(entry.name))) {
          results.push(fullPath);
        }
      }
    };

    await walk(absoluteDirPath);
    return results;
  }

  async resolveImportToFile(
    fromFileAbsolutePath: string,
    importSource: string,
  ): Promise<string | null> {
    const baseDir = path.dirname(fromFileAbsolutePath);
    const candidateBase = path.resolve(baseDir, importSource);

    // 1. Caminho exato (já tem extensão, ex: "./format.ts")
    if (await fs.pathExists(candidateBase)) {
      const stat = await fs.stat(candidateBase);
      if (stat.isFile()) return candidateBase;
    }

    // 2. Testa "candidateBase.ext"
    for (const ext of RESOLVABLE_EXTENSIONS) {
      const withExt = `${candidateBase}${ext}`;
      if (await fs.pathExists(withExt)) return withExt;
    }

    // 3. Testa "candidateBase/index.ext"
    for (const ext of RESOLVABLE_EXTENSIONS) {
      const indexFile = path.join(candidateBase, `index${ext}`);
      if (await fs.pathExists(indexFile)) return indexFile;
    }

    return null;
  }

  async findNearestPackageJson(fromAbsolutePath: string): Promise<PackageJsonInfo | null> {
    let currentDir = (await fs.stat(fromAbsolutePath)).isDirectory()
      ? fromAbsolutePath
      : path.dirname(fromAbsolutePath);

    while (true) {
      const candidate = path.join(currentDir, "package.json");
      if (await fs.pathExists(candidate)) {
        const json = await fs.readJson(candidate);
        return {
          path: candidate,
          dependencies: json.dependencies ?? {},
          devDependencies: json.devDependencies ?? {},
        };
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) return null; // chegou na raiz do filesystem
      currentDir = parentDir;
    }
  }
}
