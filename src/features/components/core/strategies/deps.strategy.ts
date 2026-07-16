import path from "node:path";
import type { ISaveStrategy, StrategyResult } from "../../../../shared/core/interfaces/save-strategy.interface.js";
import type { IAstParser } from "../../../../shared/core/interfaces/ast-parser.interface.js";
import type { IFileSystemClient } from "../../../../shared/core/interfaces/file-system-client.interface.js";
import { extractPackageName, findVersionInPackageJson } from "../../../../shared/utils/dependency-version.util.js";

/**
 * Deps: salva apenas o arquivo principal (assim como Raw), mas trata o manifesto
 * de dependências externas como um contrato "ativo": o comando `add` vai oferecer
 * para instalar automaticamente qualquer dependência faltante no projeto de destino.
 * Importações locais continuam sendo ignoradas (não resolvidas nem copiadas).
 */
export class DepsStrategy implements ISaveStrategy {
  readonly name = "deps" as const;

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
