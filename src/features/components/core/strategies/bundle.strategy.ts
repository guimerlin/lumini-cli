import path from "node:path";
import type { ISaveStrategy, StrategyResult } from "../../../../shared/core/interfaces/save-strategy.interface.js";
import type { IAstParser } from "../../../../shared/core/interfaces/ast-parser.interface.js";
import type { IFileSystemClient } from "../../../../shared/core/interfaces/file-system-client.interface.js";
import { DependencyGraphService } from "../dependency-graph.service.js";

/**
 * Bundle: injeta todo o código dos arquivos locais importados dentro do arquivo
 * de entrada, gerando um único arquivo autossuficiente (exceto por deps externas).
 *
 * Limitação honesta: isto NÃO é um bundler completo (não faz tree-shaking, não
 * resolve colisões de nomes entre módulos diferentes que exportem símbolos com
 * o mesmo identificador, e não lida com `export default` duplicado). Para a
 * grande maioria dos casos de "componente + alguns hooks/utils" isso funciona bem;
 * para árvores muito grandes ou com nomes colidentes, prefira a estratégia Folder.
 */
export class BundleStrategy implements ISaveStrategy {
  readonly name = "bundle" as const;
  private readonly graphService: DependencyGraphService;

  constructor(
    private readonly astParser: IAstParser,
    fsClient: IFileSystemClient,
  ) {
    this.graphService = new DependencyGraphService(astParser, fsClient);
  }

  async resolve(targetAbsolutePath: string): Promise<StrategyResult> {
    const graph = await this.graphService.build(targetAbsolutePath);
    const entryNode = graph.nodes.find((n) => n.isEntry)!;
    const dependencyNodes = graph.nodes.filter((n) => !n.isEntry);

    const localSources = new Set<string>();
    for (const node of graph.nodes) {
      for (const imp of node.imports) {
        if (imp.isRelative && imp.resolvedPath) localSources.add(imp.source);
      }
    }

    const chunks: string[] = [];

    // Injeta as dependências primeiro (ordem topológica aproximada: folhas antes da raiz
    // seria ideal, mas para código JS/TS a ordem de declaração raramente importa
    // graças a hoisting de function/const no escopo do módulo).
    for (const node of dependencyNodes) {
      const strippedCode = this.astParser.stripImportsBySource(
        node.content,
        node.imports.filter((i) => i.isRelative).map((i) => i.source),
      );
      chunks.push(
        `// ---- injetado de: ${path.relative(path.dirname(targetAbsolutePath), node.absolutePath)} ----\n${strippedCode.trim()}`,
      );
    }

    const entryStripped = this.astParser.stripImportsBySource(entryNode.content, Array.from(localSources));
    chunks.push(`// ---- ${path.basename(targetAbsolutePath)} (entrada) ----\n${entryStripped.trim()}`);

    const bundledCode = chunks.join("\n\n");
    const fileName = path.basename(targetAbsolutePath);

    return {
      files: [{ relativePath: fileName, content: bundledCode }],
      entryFile: fileName,
      isDirectory: false,
      externalDependencies: graph.externalDependencies,
    };
  }
}
