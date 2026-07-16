import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { AstParserClient } from "../../infrastructure/parsers/ast-parser.client.js";
import { FileSystemClient } from "../../infrastructure/clients/file-system.client.js";
import { StorageClient } from "../../infrastructure/clients/storage.client.js";
import { RawStrategy } from "../../core/services/strategies/raw.strategy.js";
import { DepsStrategy } from "../../core/services/strategies/deps.strategy.js";
import { BundleStrategy } from "../../core/services/strategies/bundle.strategy.js";
import { FolderStrategy } from "../../core/services/strategies/folder.strategy.js";
import { SaveComponentService } from "../../core/services/save-component.service.js";
import { askComponentName, askStrategy } from "../prompts/strategy.prompt.js";
import type { SaveStrategy } from "../../core/entities/metadata.entity.js";

export function registerSaveCommand(program: Command): void {
  program
    .command("save <caminho>")
    .description("Analisa e salva um arquivo ou pasta na biblioteca do Lumini")
    .option("-n, --name <nome>", "nome do componente na biblioteca (padrão: nome do arquivo/pasta)")
    .option(
      "-s, --strategy <estrategia>",
      "raw | deps | bundle | folder — pula a pergunta interativa",
    )
    .action(async (caminho: string, options: { name?: string; strategy?: string }) => {
      const targetAbsolutePath = path.resolve(process.cwd(), caminho);

      const astParser = new AstParserClient();
      const fsClient = new FileSystemClient();
      const storageClient = new StorageClient();

      if (!(await fsClient.exists(targetAbsolutePath))) {
        console.error(chalk.red(`✗ Caminho não encontrado: ${targetAbsolutePath}`));
        process.exitCode = 1;
        return;
      }

      const isDir = await fsClient.isDirectory(targetAbsolutePath);

      // Checagem rápida de imports locais para decidir defaults do prompt.
      let hasLocalImports = true;
      if (!isDir) {
        const { imports } = await astParser.parseFile(targetAbsolutePath);
        hasLocalImports = imports.some((i) => i.isRelative);
      }

      const defaultName = isDir
        ? path.basename(targetAbsolutePath)
        : path.basename(targetAbsolutePath, path.extname(targetAbsolutePath));

      const strategy: SaveStrategy =
        (options.strategy as SaveStrategy | undefined) ?? (await askStrategy(hasLocalImports));

      const name = options.name ?? (await askComponentName(defaultName));

      const saveService = new SaveComponentService(
        {
          raw: new RawStrategy(astParser, fsClient),
          deps: new DepsStrategy(astParser, fsClient),
          bundle: new BundleStrategy(astParser, fsClient),
          folder: new FolderStrategy(astParser, fsClient),
        },
        storageClient,
      );

      console.log(chalk.dim(`Analisando ${isDir ? "pasta" : "arquivo"} e resolvendo dependências...`));

      try {
        const metadata = await saveService.execute({ name, targetAbsolutePath, strategy });

        console.log(chalk.green(`✓ "${name}" salvo com a estratégia "${strategy}".`));
        console.log(chalk.dim(`  Arquivos: ${metadata.files.join(", ")}`));

        const externalDeps = Object.keys(metadata.externalDependencies);
        if (externalDeps.length > 0) {
          console.log(chalk.dim(`  Dependências externas: ${externalDeps.join(", ")}`));
        }
      } catch (error) {
        console.error(chalk.red(`✗ Falha ao salvar: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    });
}
