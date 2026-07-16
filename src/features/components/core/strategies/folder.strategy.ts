import path from "node:path";
import type { ISaveStrategy, StrategyResult } from "../../../../shared/core/interfaces/save-strategy.interface.js";
import type { IAstParser } from "../../../../shared/core/interfaces/ast-parser.interface.js";
import type { IFileSystemClient } from "../../../../shared/core/interfaces/file-system-client.interface.js";
import { DependencyGraphService } from "../dependency-graph.service.js";
import type { ComponentNode } from "../../../../shared/core/entities/component-node.entity.js";
import type { StoredFile } from "../../../../shared/core/interfaces/storage-client.interface.js";
import { extractPackageName, findVersionInPackageJson } from "../../../../shared/utils/dependency-version.util.js";

function stripExt(fileName: string): string {
  const ext = path.extname(fileName);
  return ext ? fileName.slice(0, -ext.length) : fileName;
}

/** Garante nomes únicos quando dois arquivos locais de pastas diferentes têm o mesmo basename. */
function uniqueName(baseName: string, used: Set<string>): string {
  if (!used.has(baseName)) {
    used.add(baseName);
    return baseName;
  }
  const ext = path.extname(baseName);
  const stem = stripExt(baseName);
  let counter = 2;
  let candidate = `${stem}.${counter}${ext}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${stem}.${counter}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Folder: transforma o arquivo alvo em `Nome/index.ext`, copiando para dentro
 * do mesmo diretório todos os arquivos locais importados (recursivamente) e
 * remapeando, via AST, as rotas de import para os novos caminhos relativos.
 *
 * Quando o alvo já é uma pasta, a estrutura interna é preservada como está;
 * apenas os imports que apontam para FORA da pasta são trazidos para dentro
 * (em uma subpasta `_external/`) e remapeados.
 */
export class FolderStrategy implements ISaveStrategy {
  readonly name = "folder" as const;
  private readonly graphService: DependencyGraphService;

  constructor(
    private readonly astParser: IAstParser,
    private readonly fsClient: IFileSystemClient,
  ) {
    this.graphService = new DependencyGraphService(astParser, fsClient);
  }

  async resolve(targetAbsolutePath: string): Promise<StrategyResult> {
    const isDir = await this.fsClient.isDirectory(targetAbsolutePath);
    return isDir ? this.resolveFolderTarget(targetAbsolutePath) : this.resolveFileTarget(targetAbsolutePath);
  }

  // --- Caso 1: alvo é um único arquivo ---------------------------------
  private async resolveFileTarget(targetAbsolutePath: string): Promise<StrategyResult> {
    const graph = await this.graphService.build(targetAbsolutePath);
    const entryNode = graph.nodes.find((n) => n.isEntry)!;
    const otherNodes = graph.nodes.filter((n) => !n.isEntry);

    const usedNames = new Set<string>();
    const destNameByAbsolutePath = new Map<string, string>();

    // Entrada vira sempre "index.<ext>", conforme especificado na documentação.
    const entryExt = path.extname(entryNode.absolutePath);
    const entryDestName = uniqueName(`index${entryExt}`, usedNames);
    destNameByAbsolutePath.set(entryNode.absolutePath, entryDestName);

    for (const node of otherNodes) {
      const destName = uniqueName(path.basename(node.absolutePath), usedNames);
      destNameByAbsolutePath.set(node.absolutePath, destName);
    }

    const files = this.rewriteAndFlatten(graph.nodes, destNameByAbsolutePath);

    return {
      files,
      entryFile: entryDestName,
      isDirectory: true,
      externalDependencies: graph.externalDependencies,
    };
  }

  // --- Caso 2: alvo é uma pasta -----------------------------------------
  private async resolveFolderTarget(targetAbsolutePath: string): Promise<StrategyResult> {
    const filesInFolder = await this.fsClient.listFilesRecursively(targetAbsolutePath, ["*"]);

    const nodes: ComponentNode[] = [];
    const externalDependencies: Record<string, string> = {};
    const pkgInfo = await this.fsClient.findNearestPackageJson(targetAbsolutePath);

    // Nós internos: preservam a estrutura relativa original dentro da pasta.
    for (const absPath of filesInFolder) {
      const { code, imports } = await this.astParser.parseFile(absPath);
      nodes.push({
        absolutePath: absPath,
        relativePath: path.relative(targetAbsolutePath, absPath),
        content: code,
        imports,
        isEntry: false,
      });
    }

    const internalSet = new Set(filesInFolder);
    const externalNodesByAbsolutePath = new Map<string, ComponentNode>();
    const usedExternalNames = new Set<string>();

    // Resolve imports; os que apontam pra fora da pasta viram nós "_external/".
    for (const node of nodes) {
      for (const imp of node.imports) {
        if (!imp.isRelative) {
          const pkgName = extractPackageName(imp.source);
          externalDependencies[pkgName] = findVersionInPackageJson(pkgName, pkgInfo);
          continue;
        }

        const resolved = await this.fsClient.resolveImportToFile(node.absolutePath, imp.source);
        if (!resolved) continue;
        imp.resolvedPath = resolved;

        if (!internalSet.has(resolved) && !externalNodesByAbsolutePath.has(resolved)) {
          const { code, imports: extImports } = await this.astParser.parseFile(resolved);
          const destName = uniqueName(path.basename(resolved), usedExternalNames);
          externalNodesByAbsolutePath.set(resolved, {
            absolutePath: resolved,
            relativePath: path.posix.join("_external", destName),
            content: code,
            imports: extImports,
            isEntry: false,
          });
        }
      }
    }

    const allNodes = [...nodes, ...externalNodesByAbsolutePath.values()];
    const destPathByAbsolutePath = new Map<string, string>();
    for (const node of allNodes) destPathByAbsolutePath.set(node.absolutePath, node.relativePath);

    const files = this.rewriteAndFlatten(allNodes, destPathByAbsolutePath, true);

    // Determina o "entry file": o único arquivo interno que ninguém mais importa,
    // ou o primeiro arquivo em ordem alfabética como fallback razoável.
    const importedPaths = new Set(
      nodes.flatMap((n) => n.imports.map((i) => i.resolvedPath).filter(Boolean)),
    );
    const candidateEntry = nodes.find((n) => !importedPaths.has(n.absolutePath)) ?? nodes[0];

    return {
      files,
      entryFile: candidateEntry ? destPathByAbsolutePath.get(candidateEntry.absolutePath)! : "",
      isDirectory: true,
      externalDependencies,
    };
  }

  /**
   * Para cada nó, reescreve (via AST) toda referência de import local para o
   * novo caminho relativo calculado, e devolve a lista final de StoredFile.
   */
  private rewriteAndFlatten(
    nodes: ComponentNode[],
    destPathByAbsolutePath: Map<string, string>,
    preserveDirectories = false,
  ): StoredFile[] {
    const files: StoredFile[] = [];

    for (const node of nodes) {
      let code = node.content;

      for (const imp of node.imports) {
        if (!imp.isRelative || !imp.resolvedPath) continue;
        const destForTarget = destPathByAbsolutePath.get(imp.resolvedPath);
        if (!destForTarget) continue;

        let newSource: string;
        if (preserveDirectories) {
          const fromDir = path.posix.dirname(destPathByAbsolutePath.get(node.absolutePath) ?? ".");
          newSource = path.posix.relative(fromDir, destForTarget) || `./${path.posix.basename(destForTarget)}`;
          if (!newSource.startsWith(".")) newSource = `./${newSource}`;
        } else {
          newSource = `./${stripExt(destForTarget)}`;
        }

        code = this.astParser.rewriteImportSource(code, imp.source, newSource);
      }

      files.push({
        relativePath: destPathByAbsolutePath.get(node.absolutePath) ?? path.basename(node.absolutePath),
        content: code,
      });
    }

    return files;
  }
}
