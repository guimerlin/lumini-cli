export interface ParsedImports {
  external: string[];
  local: string[];
}

export interface IAstParser {
  parseImports(fileContent: string, filePath: string): Promise<ParsedImports>;
  // updateLocalImports(fileContent: string, importMappings: Record<string, string>): Promise<string>;
}
