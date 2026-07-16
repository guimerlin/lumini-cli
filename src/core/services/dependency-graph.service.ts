import path from "node:path";
import type { IAstParser } from "../interfaces/ast-parser.interface.js";
import type { IFileSystemClient } from "../interfaces/file-system-client.interface.js";
import type { ComponentNode } from "../entities/component-node.entity.js";
import { extractPackageName, findVersionInPackageJson } from "../../utils/dependency-version.util.js";

export interface DependencyGraphResult {
  /** Todos os arquivos locais alcançados a partir da entrada, incluindo a própria entrada. */
  nodes: ComponentNode[];
  /** Mapa pacote -> versão de todas as dependências externas encontradas em qualquer nó. */
  externalDependencies: Record<string, string>;
}

/**
 * Percorre recursivamente as importações locais (relativas) a partir de um arquivo de entrada,
 * evitando ciclos, e agrega todas as dependências externas (NPM) encontradas no caminho.
 * Usado pelas estratégias Bundle e Folder, que precisam conhecer toda a árvore local.
 */
export class DependencyGraphService {
  constructor(
    private readonly astParser: IAstParser,
    private readonly fsClient: IFileSystemClient,
  ) {}

  async build(entryAbsolutePath: string): Promise<DependencyGraphResult> {
    const visited = new Map<string, ComponentNode>();
    const externalDependencies: Record<string, string> = {};
    const pkgInfo = await this.fsClient.findNearestPackageJson(entryAbsolutePath);

    const visit = async (absolutePath: string, isEntry: boolean): Promise<void> => {
      if (visited.has(absolutePath)) return;

      const { code, imports } = await this.astParser.parseFile(absolutePath);

      const node: ComponentNode = {
        absolutePath,
        relativePath: path.basename(absolutePath),
        content: code,
        imports,
        isEntry,
      };
      visited.set(absolutePath, node);

      for (const imp of imports) {
        if (imp.isRelative) {
          const resolved = await this.fsClient.resolveImportToFile(absolutePath, imp.source);
          if (resolved) {
            imp.resolvedPath = resolved;
            await visit(resolved, false);
          }
        } else {
          const pkgName = extractPackageName(imp.source);
          externalDependencies[pkgName] = findVersionInPackageJson(pkgName, pkgInfo);
        }
      }
    };

    await visit(entryAbsolutePath, true);

    return { nodes: Array.from(visited.values()), externalDependencies };
  }
}
