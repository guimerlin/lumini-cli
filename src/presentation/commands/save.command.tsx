import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { render } from "ink";
import App from "../App.js";
import { AstParserClient } from "../../shared/infrastructure/parsers/ast-parser.client.js";
import { FileSystemClient } from "../../shared/infrastructure/clients/file-system.client.js";
import { StorageClient } from "../../shared/infrastructure/clients/storage.client.js";
import { RawStrategy } from "../../features/components/core/strategies/raw.strategy.js";
import { DepsStrategy } from "../../features/components/core/strategies/deps.strategy.js";
import { BundleStrategy } from "../../features/components/core/strategies/bundle.strategy.js";
import { FolderStrategy } from "../../features/components/core/strategies/folder.strategy.js";
import { SaveComponentService } from "../../features/components/core/save-component.service.js";
import { VaultService } from "../../features/vault/core/vault.service.js";
import type { SaveStrategy } from "../../shared/core/entities/metadata.entity.js";

export function registerSaveCommand(program: Command): void {
  program
    .command("save [path]")
    .description("Analyzes and saves a file or folder into the Lumini library")
    .option("-n, --name <name>", "name of the component in the library (default: file/folder basename)")
    .option(
      "-s, --strategy <strategy>",
      "raw | deps | bundle | folder — bypass interactive strategy prompt",
    )
    .option("-t, --tag <tag>", "tag to organize the component under")
    .option("--structure", "save only folder structure (directories), ignoring files")
    .option("-d, --default", "bypass all interactive prompts and run with default settings")
    .action(
      async (
        caminho?: string,
        options: { name?: string; strategy?: string; tag?: string; structure?: boolean; default?: boolean } = {},
      ) => {
        // 1. Interactive Mode Check
        if (!options.default && !options.strategy && !options.tag) {
          const { waitUntilExit } = render(<App initialScreen="SAVE_WIZARD" targetArg={caminho} />);
          await waitUntilExit();
          return;
        }

        // 2. Direct CLI Non-interactive Mode (only executes if path is provided)
        if (!caminho) {
          console.error(chalk.red("✗ Path is required in non-interactive mode."));
          process.exitCode = 1;
          return;
        }

        const targetAbsolutePath = path.resolve(process.cwd(), caminho);

        const astParser = new AstParserClient();
        const fsClient = new FileSystemClient();
        const storageClient = new StorageClient();
        const vaultService = new VaultService(fsClient);

        if (!(await fsClient.exists(targetAbsolutePath))) {
          console.error(chalk.red(`✗ Path not found: ${targetAbsolutePath}`));
          process.exitCode = 1;
          return;
        }

        const isDir = await fsClient.isDirectory(targetAbsolutePath);

        // Identify if target is ONLY .env files
        let isEnvOnly = false;
        let envFilesList: string[] = [];

        if (isDir) {
          const allFiles = await fsClient.listFilesRecursively(targetAbsolutePath, ["*"]);
          const onlyEnvs = allFiles.length > 0 && allFiles.every((f) => path.basename(f).startsWith(".env"));
          if (onlyEnvs) {
            isEnvOnly = true;
            envFilesList = allFiles;
          }
        } else if (path.basename(targetAbsolutePath).startsWith(".env")) {
          isEnvOnly = true;
          envFilesList = [targetAbsolutePath];
        }

        const defaultName = isDir
          ? path.basename(targetAbsolutePath)
          : path.basename(targetAbsolutePath, path.extname(targetAbsolutePath));

        if (isEnvOnly) {
          // Vault non-interactive path
          const vaultName = options.name ?? defaultName;
          const combinedVars: Record<string, string> = {};
          for (const file of envFilesList) {
            const content = await fsClient.readFile(file);
            Object.assign(combinedVars, vaultService.parseEnv(content));
          }
          await vaultService.saveVault(vaultName, combinedVars);
          console.log(
            chalk.green(
              `✓ Environment variables from ${isDir ? "directory" : `"${path.basename(targetAbsolutePath)}"`} successfully saved to Vault "${vaultName}".`,
            ),
          );
          return;
        }

        // Proceed to save as regular component in direct mode
        const name = options.name ?? defaultName;

        // Scan for .env files within the component target to potentially vault them (only if not already vaulted)
        let envFileAbsPath: string | null = null;
        if (isDir) {
          const allFiles = await fsClient.listFilesRecursively(targetAbsolutePath, ["*"]);
          const found = allFiles.find((f) => path.basename(f).startsWith(".env"));
          if (found) envFileAbsPath = found;
        } else if (path.basename(targetAbsolutePath).startsWith(".env")) {
          envFileAbsPath = targetAbsolutePath;
        }

        let excludeFiles: string[] = [];

        if (envFileAbsPath && options.default) {
          // If default flag is passed, we default to saving the env inside the component code (no vault extraction)
          // to bypass prompts
        }

        // Check if there are JS/TS files
        let hasJsTs = false;
        if (isDir) {
          const allFiles = await fsClient.listFilesRecursively(targetAbsolutePath, ["*"]);
          hasJsTs = allFiles.some((f) => {
            const ext = path.extname(f).toLowerCase();
            return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext);
          });
        } else {
          const ext = path.extname(targetAbsolutePath).toLowerCase();
          hasJsTs = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext);
        }

        let hasLocalImports = false;
        if (hasJsTs && !isDir) {
          try {
            const { imports } = await astParser.parseFile(targetAbsolutePath);
            hasLocalImports = imports.some((i) => i.isRelative);
          } catch {
            hasLocalImports = false;
          }
        }

        const strategy: SaveStrategy =
          (options.strategy as SaveStrategy | undefined) ??
          (!hasJsTs
            ? "raw"
            : hasLocalImports
            ? "folder"
            : "raw");

        let tag = options.tag || "_general";

        const saveService = new SaveComponentService(
          {
            raw: new RawStrategy(astParser, fsClient),
            deps: new DepsStrategy(astParser, fsClient),
            bundle: new BundleStrategy(astParser, fsClient),
            folder: new FolderStrategy(astParser, fsClient),
          },
          storageClient,
          fsClient,
        );

        console.log(chalk.dim(`Analyzing ${isDir ? "folder" : "file"} and resolving dependencies...`));

        try {
          const metadata = await saveService.execute({
            name,
            targetAbsolutePath,
            strategy,
            tag,
            structureOnly: options.structure,
            excludeFiles,
            associatedVault: undefined,
          });

          const displayTag = tag === "_general" ? "" : `@[${tag}]/`;
          console.log(chalk.green(`✓ "${displayTag}${name}" saved successfully with strategy "${strategy}".`));
          
          if (options.structure) {
            console.log(chalk.dim(`  Folders structure saved: ${metadata.files.length} directory(ies)`));
          } else {
            console.log(chalk.dim(`  Files: ${metadata.files.join(", ")}`));
            const externalDeps = Object.keys(metadata.externalDependencies);
            if (externalDeps.length > 0) {
              console.log(chalk.dim(`  External dependencies: ${externalDeps.join(", ")}`));
            }
          }
        } catch (error) {
          console.error(chalk.red(`✗ Failed to save: ${(error as Error).message}`));
          process.exitCode = 1;
        }
      },
    );
}
