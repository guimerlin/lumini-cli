import path from "node:path";
import fs from "fs-extra";
import type {
  IFileSystemClient,
  PackageJsonInfo,
} from "../../core/interfaces/file-system-client.interface.js";

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

class GitignoreMatcher {
  private rules: { pattern: string; isDirOnly: boolean; isNegation: boolean }[] = [];

  constructor(content: string) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      let pattern = trimmed;
      let isNegation = false;
      if (pattern.startsWith("!")) {
        isNegation = true;
        pattern = pattern.slice(1);
      }

      const isDirOnly = pattern.endsWith("/");
      if (isDirOnly) {
        pattern = pattern.slice(0, -1);
      }

      this.rules.push({ pattern, isDirOnly, isNegation });
    }
  }

  ignores(relativePath: string, isDirectory: boolean): boolean {
    const normalizedPath = relativePath.replace(/\\/g, "/");
    let ignored = false;

    // Default ignores for directories that are standard
    const defaultIgnores = ["node_modules", ".git", "dist", ".lumini", "vault"];
    const segments = normalizedPath.split("/");
    if (segments.some((seg) => defaultIgnores.includes(seg))) {
      return true;
    }

    for (const rule of this.rules) {
      if (rule.isDirOnly && !isDirectory) continue;

      let matches = false;
      if (rule.pattern.startsWith("/")) {
        const cleanPattern = rule.pattern.slice(1);
        matches = normalizedPath === cleanPattern || normalizedPath.startsWith(cleanPattern + "/");
      } else {
        matches = segments.includes(rule.pattern) || normalizedPath.includes("/" + rule.pattern + "/");
      }

      if (matches) {
        ignored = !rule.isNegation;
      }
    }

    return ignored;
  }
}

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

    // Find nearest gitignore
    let searchDir = absoluteDirPath;
    let gitignoreContent = "";
    let gitignoreDir = absoluteDirPath;
    while (true) {
      const candidate = path.join(searchDir, ".gitignore");
      if (await fs.pathExists(candidate)) {
        gitignoreContent = await fs.readFile(candidate, "utf-8");
        gitignoreDir = searchDir;
        break;
      }
      const parentDir = path.dirname(searchDir);
      if (parentDir === searchDir || searchDir === process.cwd()) break;
      searchDir = parentDir;
    }

    const matcher = new GitignoreMatcher(gitignoreContent);

    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(gitignoreDir, fullPath);
        const isDirectory = entry.isDirectory();

        if (matcher.ignores(relPath, isDirectory)) {
          continue;
        }

        if (isDirectory) {
          await walk(fullPath);
        } else {
          const ext = path.extname(entry.name);
          if (extensions.includes("*") || extensions.includes(ext)) {
            results.push(fullPath);
          }
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

  async listDirectoriesRecursively(absoluteDirPath: string): Promise<string[]> {
    const results: string[] = [];

    let searchDir = absoluteDirPath;
    let gitignoreContent = "";
    let gitignoreDir = absoluteDirPath;
    while (true) {
      const candidate = path.join(searchDir, ".gitignore");
      if (await fs.pathExists(candidate)) {
        gitignoreContent = await fs.readFile(candidate, "utf-8");
        gitignoreDir = searchDir;
        break;
      }
      const parentDir = path.dirname(searchDir);
      if (parentDir === searchDir || searchDir === process.cwd()) break;
      searchDir = parentDir;
    }

    const matcher = new GitignoreMatcher(gitignoreContent);

    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(gitignoreDir, fullPath);

        if (matcher.ignores(relPath, true)) {
          continue;
        }

        results.push(fullPath);
        await walk(fullPath);
      }
    };

    await walk(absoluteDirPath);
    return results;
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
