import type { IAstParser, ParsedImports } from '../../core/interfaces/IAstParser.js';
import * as tsLib from 'typescript';

// Explicitly requiring since import resolution for ts in this environment has issues
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

export class AstParserClient implements IAstParser {
  async parseImports(fileContent: string, filePath: string): Promise<ParsedImports> {
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    const external: string[] = [];
    const local: string[] = [];

    const visit = (node: any) => {
      // Handle import declarations: import { X } from 'y';
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const importPath = moduleSpecifier.text;
          if (importPath.startsWith('.') || importPath.startsWith('/')) {
            local.push(importPath);
          } else {
            external.push(importPath);
          }
        }
      }

      // Handle dynamic imports or requires if needed (simplifying for now)
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
         if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
           const importPath = node.arguments[0].text;
            if (importPath.startsWith('.') || importPath.startsWith('/')) {
              local.push(importPath);
            } else {
              external.push(importPath);
            }
         }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      external: [...new Set(external)],
      local: [...new Set(local)],
    };
  }
}
