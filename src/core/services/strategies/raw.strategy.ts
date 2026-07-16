import path from "node:path";
import type { ISaveStrategy, StrategyResult } from "../../interfaces/save-strategy.interface.js";
import type { IAstParser } from "../../interfaces/ast-parser.interface.js";
import type { IFileSystemClient } from "../../interfaces/file-system-client.interface.js";
import { extractPackageName, findVersionInPackageJson } from "../../../utils/dependency-version.util.js";

/**
 * Raw: salva o arquivo exatamente como está. Importações locais NÃO são resolvidas
 * nem copiadas — ficam como estavam no código original (o usuário assume o risco
 * de o import quebrar no novo projeto). Dependências externas são apenas anotadas.
 */
export class RawStrategy implements ISaveStrategy {
  readonly name = "raw" as const;

  constructor(
    private readonly astParser: IAstParser,
    private readonly fsClient: IFileSystemClient,
  ) {}

  async resolve(targetAbsolutePath: string): Promise<StrategyResult> {
    const { code, imports } = await this.astParser.parseFile(targetAbsolutePath);
    const pkgInfo = await this.fsClient.findNearestPackageJson(targetAbsolutePath);

    const externalDependencies: Record<string, string> = {};
    for (const imp of imports) {
      if (!imp.isRelative) {
        const pkgName = extractPackageName(imp.source);
        externalDependencies[pkgName] = findVersionInPackageJson(pkgName, pkgInfo);
      }
    }

    const fileName = path.basename(targetAbsolutePath);

    return {
      files: [{ relativePath: fileName, content: code }],
      entryFile: fileName,
      isDirectory: false,
      externalDependencies,
    };
  }
}
