import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { render } from "ink";
import App from "../App.js";
import { FileSystemClient } from "../../shared/infrastructure/clients/file-system.client.js";
import { StorageClient } from "../../shared/infrastructure/clients/storage.client.js";
import { AddComponentService } from "../../features/components/core/add-component.service.js";
import { ConfigService } from "../../features/config/core/config.service.js";
import { VaultService } from "../../features/vault/core/vault.service.js";
import fs from "fs-extra";

export function registerAddCommand(program: Command): void {
  program
    .command("add [name]")
    .description("Injects a previously saved component into the current directory")
    .option("-d, --dest <folder>", "destination folder")
    .option("-y, --yes", "auto-confirm prompts (like overwriting and dependency installation)")
    .option("--default", "bypass all interactive prompts and run with default settings")
    .action(async (name?: string, options: { dest?: string; yes?: boolean; default?: boolean } = {}) => {
      // 1. Interactive Mode Check
      if (!options.default && !options.yes) {
        const { waitUntilExit } = render(<App initialScreen="ADD_WIZARD" targetArg={name} />);
        await waitUntilExit();
        return;
      }

      // 2. Direct CLI Non-interactive Mode (only executes if name is provided)
      if (!name) {
        console.error(chalk.red("✗ Component name is required in non-interactive mode."));
        process.exitCode = 1;
        return;
      }

      const fsClient = new FileSystemClient();
      const storageClient = new StorageClient();
      const addService = new AddComponentService(storageClient, fsClient);
      const configService = new ConfigService(fsClient);

      if (!(await storageClient.exists(name))) {
        console.error(
          chalk.red(`✗ Component "${name}" not found in the library. Run "lumini list" to see available components.`),
        );
        process.exitCode = 1;
        return;
      }

      const configExists = await configService.exists();
      const config = configExists ? await configService.read() : {};

      const isAlreadyImported = config.importedComponents && name in config.importedComponents;
      if (isAlreadyImported && !options.yes) {
        console.log(chalk.yellow(`⚠ Component "${name}" is already imported. Bypass with --yes or run interactively.`));
        return;
      }

      const destination = options.dest || config.defaultImportPath || ".";
      const destinationDirAbsolutePath = path.resolve(process.cwd(), destination);

      try {
        const result = await addService.execute({ name, destinationDirAbsolutePath });

        const displayTag = result.metadata.tag && result.metadata.tag !== "_general" ? `@[${result.metadata.tag}]/` : "";
        console.log(chalk.green(`✓ "${displayTag}${result.metadata.name}" added successfully.`));

        if (result.metadata.structureOnly) {
          console.log(
            chalk.dim(`  Created folder structure inside ${path.relative(process.cwd(), destinationDirAbsolutePath)}`),
          );
        } else {
          for (const file of result.writtenFiles) {
            console.log(chalk.dim(`  + ${path.relative(process.cwd(), file)}`));
          }
        }

        const updatedConfig = await configService.read();
        if (!updatedConfig.defaultImportPath && destination) {
          updatedConfig.defaultImportPath = destination;
          await configService.write(updatedConfig);
        }
        await configService.registerImport(name, result.metadata.tag, result.writtenFiles);

        // Vault Import logic
        if (result.metadata.associatedVault) {
          const vaultName = result.metadata.associatedVault;
          const vaultService = new VaultService(fsClient);
          const vaults = await vaultService.listVaults();
          const targetVault = vaults.find((v) => v.name === vaultName);
          
          if (targetVault) {
            // In non-interactive mode with bypass flags, we auto-import all vault variables
            const varsToImport = targetVault.variables;
            if (Object.keys(varsToImport).length > 0) {
              const targetEnvPath = path.resolve(process.cwd(), ".env");
              let envContent = "";
              if (await fsClient.exists(targetEnvPath)) {
                envContent = await fsClient.readFile(targetEnvPath);
              }
              const existingVars = vaultService.parseEnv(envContent);
              const merged = { ...existingVars, ...varsToImport };
              const outputContent = Object.entries(merged)
                .map(([k, v]) => `${k}=${v}`)
                .join("\n");
              await fsClient.writeFile(targetEnvPath, outputContent);
              await configService.registerVaultImport(vaultName, Object.keys(varsToImport));
              console.log(chalk.green(`[Vault] Automatically imported variables from vault "${vaultName}" into project's .env file.`));
            }
          }
        }

        // Install dependencies
        if (result.missingDependencies.length > 0) {
          const pkgInfo = await fsClient.findNearestPackageJson(destinationDirAbsolutePath);
          if (pkgInfo) {
            const pkgJson = await fs.readJson(pkgInfo.path);
            pkgJson.dependencies = pkgJson.dependencies ?? {};
            for (const dep of result.missingDependencies) {
              pkgJson.dependencies[dep.name] = dep.version;
            }
            await fs.writeJson(pkgInfo.path, pkgJson, { spaces: 2 });
            console.log(
              chalk.green(`✓ Added missing dependency(ies) to package.json. Please run: npm/pnpm/yarn install`),
            );
          } else {
            console.log(
              chalk.yellow("⚠ No package.json found from destination path; install manually:"),
            );
            for (const dep of result.missingDependencies) {
              console.log(chalk.dim(`  ${dep.name}: ${dep.version}`));
            }
          }
        }
      } catch (error) {
        console.error(chalk.red(`✗ Failed to add: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    });
}
