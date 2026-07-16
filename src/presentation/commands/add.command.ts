import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { FileSystemClient } from "../../infrastructure/clients/file-system.client.js";
import { StorageClient } from "../../infrastructure/clients/storage.client.js";
import { AddComponentService } from "../../core/services/add-component.service.js";
import { ConfigService } from "../../core/services/config.service.js";
import { VaultService } from "../../core/services/vault.service.js";
import {
  askConfirmInstallDeps,
  askDestination,
  askConfirmOverwrite,
  askInitConfig,
} from "../prompts/add.prompt.js";
import {
  askImportLinkedVault,
  askLinkedVaultImportType,
  askSelectVaultKeys,
  runVaultImportFlow,
} from "../prompts/vault-import.prompt.js";
import fs from "fs-extra";

export function registerAddCommand(program: Command): void {
  program
    .command("add <name>")
    .description("Injects a previously saved component into the current directory")
    .option("-d, --dest <folder>", "destination folder")
    .option("-y, --yes", "auto-confirm prompts (like overwriting and dependency installation)")
    .option("--default", "bypass all interactive prompts and run with default settings")
    .action(async (name: string, options: { dest?: string; yes?: boolean; default?: boolean }) => {
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

      let configExists = await configService.exists();
      if (!configExists && !options.default && !options.yes) {
        const init = await askInitConfig();
        if (init) {
          await configService.write({
            defaultImportPath: options.dest ?? ".",
            importedComponents: {},
          });
          configExists = true;
          console.log(chalk.green("✓ Initialized .lumini configuration file in project root."));
        }
      }

      const config = configExists ? await configService.read() : {};

      const isAlreadyImported = config.importedComponents && name in config.importedComponents;
      if (isAlreadyImported && !options.yes && !options.default) {
        const overwrite = await askConfirmOverwrite(name);
        if (!overwrite) {
          console.log(chalk.yellow("Aborted."));
          return;
        }
      }

      let destination = options.dest;
      if (!destination) {
        if (config.defaultImportPath) {
          destination = config.defaultImportPath;
        } else if (options.default) {
          destination = ".";
        } else {
          destination = await askDestination(".");
        }
      }

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

        if (result.metadata.associatedVault) {
          const vaultName = result.metadata.associatedVault;
          const vaultService = new VaultService(fsClient);
          const vaults = await vaultService.listVaults();
          const targetVault = vaults.find((v) => v.name === vaultName);
          
          if (targetVault) {
            let shouldImport = options.yes || options.default;
            if (!shouldImport) {
              shouldImport = await askImportLinkedVault(vaultName);
            }

            if (shouldImport) {
              let varsToImport = targetVault.variables;
              const config = await configService.read();
              const alreadyImportedKeys = config.importedVaults?.[vaultName] ?? [];

              if (!options.yes && !options.default) {
                const importType = await askLinkedVaultImportType();
                if (importType === "select") {
                  const selectedKeys = await askSelectVaultKeys(targetVault.variables, alreadyImportedKeys);
                  varsToImport = {};
                  for (const key of selectedKeys) {
                    varsToImport[key] = targetVault.variables[key] as string;
                  }
                }
              }

              if (Object.keys(varsToImport).length > 0) {
                const targetEnvPath = path.resolve(process.cwd(), ".env");
                const success = await runVaultImportFlow(
                  vaultName,
                  varsToImport,
                  targetEnvPath,
                  configService,
                  vaultService,
                  options.yes || options.default,
                );
                if (success) {
                  console.log(chalk.green(`[Vault] Successfully imported variables from vault "${vaultName}" into project's .env file.`));
                }
              }
            }
          }
        }

        if (result.missingDependencies.length > 0) {
          const depNames = result.missingDependencies.map((d) => d.name);
          const shouldInstall = options.yes || options.default || (await askConfirmInstallDeps(depNames));

          if (shouldInstall) {
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
          } else {
            console.log(chalk.yellow("⚠ Please remember to install dependencies manually:"));
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
