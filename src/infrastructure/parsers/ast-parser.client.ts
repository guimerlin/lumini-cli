import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "@babel/parser";
// @babel/traverse e @babel/generator publicam CJS; em ESM o default vem dentro de `.default`.
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import type { NodePath } from "@babel/traverse";
import type * as t from "@babel/types";
import type { IAstParser, ParsedFile } from "../../core/interfaces/ast-parser.interface.js";
import type { ImportInfo } from "../../core/entities/component-node.entity.js";

type TraverseFn = (ast: t.Node, visitor: Record<string, (path: NodePath<any>) => void>) => void;
type GenerateFn = (ast: t.Node, opts?: Record<string, unknown>) => { code: string };

const traverse = ((_traverse as unknown as { default?: TraverseFn }).default ??
  (_traverse as unknown as TraverseFn)) as TraverseFn;
const generate = ((_generate as unknown as { default?: GenerateFn }).default ??
  (_generate as unknown as GenerateFn)) as GenerateFn;

const BABEL_PLUGINS: import("@babel/parser").ParserPlugin[] = [
  "typescript",
  "jsx",
  "decorators-legacy",
  "classProperties",
  "topLevelAwait",
];

const JS_TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function isRelativeSource(source: string): boolean {
  return source.startsWith(".") || source.startsWith("/");
}

/** Extrai nomes de specifiers de um import declaration, só para fins de metadado/log. */
function extractSpecifiers(node: t.ImportDeclaration): string[] {
  return node.specifiers.map((spec) => {
    if (spec.type === "ImportDefaultSpecifier") return "default";
    if (spec.type === "ImportNamespaceSpecifier") return "*";
    return spec.local.name;
  });
}

export class AstParserClient implements IAstParser {
  async parseFile(absolutePath: string): Promise<ParsedFile> {
    const code = await readFile(absolutePath, "utf-8");
    const ext = path.extname(absolutePath).toLowerCase();
    
    if (!JS_TS_EXTENSIONS.includes(ext)) {
      return { code, imports: [] };
    }

    try {
      const imports = this.extractImports(code);
      return { code, imports };
    } catch {
      return { code, imports: [] };
    }
  }

  private extractImports(code: string): ImportInfo[] {
    const ast = parse(code, {
      sourceType: "module",
      plugins: BABEL_PLUGINS,
    });

    const imports: ImportInfo[] = [];

    traverse(ast, {
      ImportDeclaration: (path: NodePath<t.ImportDeclaration>) => {
        const source = path.node.source.value;
        imports.push({
          source,
          isRelative: isRelativeSource(source),
          specifiers: extractSpecifiers(path.node),
        });
      },
      ExportNamedDeclaration: (path: NodePath<t.ExportNamedDeclaration>) => {
        if (path.node.source) {
          const source = path.node.source.value;
          imports.push({ source, isRelative: isRelativeSource(source), specifiers: [] });
        }
      },
      ExportAllDeclaration: (path: NodePath<t.ExportAllDeclaration>) => {
        const source = path.node.source.value;
        imports.push({ source, isRelative: isRelativeSource(source), specifiers: [] });
      },
    });

    return imports;
  }

  rewriteImportSource(code: string, oldSource: string, newSource: string): string {
    try {
      const ast = parse(code, { sourceType: "module", plugins: BABEL_PLUGINS });

      traverse(ast, {
        "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration": (
          path: NodePath<t.ImportDeclaration | t.ExportNamedDeclaration | t.ExportAllDeclaration>,
        ) => {
          const sourceNode = path.node.source;
          if (sourceNode && sourceNode.value === oldSource) {
            sourceNode.value = newSource;
          }
        },
      });

      return generate(ast, { retainLines: false }).code;
    } catch {
      return code;
    }
  }

  stripImportsBySource(code: string, sources: string[]): string {
    try {
      const ast = parse(code, { sourceType: "module", plugins: BABEL_PLUGINS });
      const sourceSet = new Set(sources);

      traverse(ast, {
        "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration": (
          path: NodePath<t.ImportDeclaration | t.ExportNamedDeclaration | t.ExportAllDeclaration>,
        ) => {
          const sourceNode = path.node.source;
          if (sourceNode && sourceSet.has(sourceNode.value)) {
            path.remove();
          }
        },
      });

      return generate(ast, { retainLines: false }).code;
    } catch {
      return code;
    }
  }
}
