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
import { VaultService } from "../../core/services/vault.service.js";
import {
  askComponentName,
  askStrategy,
  askTag,
  askEnvVaultOption,
  askVaultName,
  askSaveEnvChoice,
} from "../prompts/strategy.prompt.js";
import type { SaveStrategy } from "../../core/entities/metadata.entity.js";

export function registerSaveCommand(program: Command): void {
  program
    .command("save <path>")
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
        caminho: string,
        options: { name?: string; strategy?: string; tag?: string; structure?: boolean; default?: boolean },
      ) => {
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

        let chosenSaveType: "vault" | "library" = "library";
        if (isEnvOnly) {
          if (options.default) {
            chosenSaveType = "vault";
          } else {
            const firstEnvName = path.basename(envFilesList[0] || ".env");
            chosenSaveType = await askSaveEnvChoice(firstEnvName, isDir);
          }
        }

        if (chosenSaveType === "vault") {
          const vaultName = options.name ?? (options.default ? defaultName : await askVaultName(defaultName));
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

        // Proceed to save as regular component
        const name = options.name ?? (options.default ? defaultName : await askComponentName(defaultName, isDir));

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
        let savedVaultInfo: { name: string; file: string } | null = null;

        if (envFileAbsPath) {
          const envFilename = path.basename(envFileAbsPath);
          const relativeEnvPath = isDir ? path.relative(targetAbsolutePath, envFileAbsPath) : envFilename;

          if (options.default) {
            // Keep it in component
          } else {
            const vaultOption = await askEnvVaultOption(envFilename);
            if (vaultOption === "vault") {
              const vaultName = await askVaultName(options.name ?? defaultName);
              const envContent = await fsClient.readFile(envFileAbsPath);
              const parsedVars = vaultService.parseEnv(envContent);
              
              await vaultService.saveVault(vaultName, parsedVars);
              excludeFiles.push(relativeEnvPath);
              savedVaultInfo = { name: vaultName, file: envFilename };
            } else if (vaultOption === "ignore") {
              excludeFiles.push(relativeEnvPath);
            }
          }
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
            : options.default
            ? hasLocalImports
              ? "folder"
              : "raw"
            : await askStrategy(hasLocalImports, isDir));

        let tag = options.tag;
        if (!tag && !options.default) {
          const components = await storageClient.list();
          const existingTags = [...new Set(components.map((c) => c.tag).filter(Boolean))] as string[];
          tag = await askTag(existingTags, isDir);
        }
        if (!tag) {
          tag = "_general";
        }

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
            associatedVault: savedVaultInfo?.name,
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

          if (savedVaultInfo) {
            console.log(
              chalk.green(
                `✓ Environment variables from "${savedVaultInfo.file}" successfully saved to Vault "${savedVaultInfo.name}".`,
              ),
            );
          }
        } catch (error) {
          console.error(chalk.red(`✗ Failed to save: ${(error as Error).message}`));
          process.exitCode = 1;
        }
      },
    );
}
