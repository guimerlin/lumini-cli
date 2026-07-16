import inquirer from "inquirer";
import chalk from "chalk";
import path from "node:path";
import type { ComponentMetadata } from "../../core/entities/metadata.entity.js";
import type { VaultInfo } from "../../core/services/vault.service.js";
import { StorageClient } from "../../infrastructure/clients/storage.client.js";
import { FileSystemClient } from "../../infrastructure/clients/file-system.client.js";
import { AddComponentService } from "../../core/services/add-component.service.js";
import { ConfigService } from "../../core/services/config.service.js";
import { VaultService } from "../../core/services/vault.service.js";
import {
  askDestination,
  askConfirmInstallDeps,
  askConfirmOverwrite,
} from "./add.prompt.js";
import fs from "fs-extra";

export async function runInteractiveDashboard(): Promise<void> {
  const fsClient = new FileSystemClient();
  const storageClient = new StorageClient();
  const addService = new AddComponentService(storageClient, fsClient);
  const configService = new ConfigService(fsClient);
  const vaultService = new VaultService(fsClient);

  while (true) {
    console.clear();
    console.log(chalk.bold.cyan("\n======================================="));
    console.log(chalk.bold.magenta("           LUMINI CLI DASHBOARD        "));
    console.log(chalk.bold.cyan("=======================================\n"));

    // List Vaults with masked values
    const vaults = await vaultService.listVaults();
    if (vaults.length > 0) {
      console.log(chalk.bold.yellow("🔒  Vaults:"));
      for (const vault of vaults) {
        console.log(`  ${chalk.bold(vault.name)}:`);
        for (const key of Object.keys(vault.variables)) {
          console.log(`    ${key}=******`);
        }
      }
      console.log();
    } else {
      console.log(chalk.dim("🔒  No vaults stored yet.\n"));
    }

    const components = await storageClient.list();

    const { choice } = await inquirer.prompt<{ choice: string }>([
      {
        type: "list",
        name: "choice",
        message: chalk.bold("Select an action:"),
        choices: [
          { name: `📦  Manage Components (${components.length} saved)`, value: "components" },
          { name: `🔒  Manage Vaults (${vaults.length} stored)`, value: "vaults" },
          { name: "❌  Exit", value: "exit" },
        ],
      },
    ]);

    if (choice === "exit") {
      console.log(chalk.cyan("\nGoodbye!"));
      break;
    }

    if (choice === "components") {
      await manageComponentsFlow(components, storageClient, addService, configService, fsClient);
    } else if (choice === "vaults") {
      await manageVaultsFlow(vaults, vaultService);
    }
  }
}

async function manageComponentsFlow(
  components: ComponentMetadata[],
  storageClient: StorageClient,
  addService: AddComponentService,
  configService: ConfigService,
  fsClient: FileSystemClient,
): Promise<void> {
  if (components.length === 0) {
    console.log(chalk.yellow("\nNo components saved yet. Save a component first!"));
    await inquirer.prompt([{ type: "input", name: "ok", message: "Press Enter to return..." }]);
    return;
  }

  // Multi-select components
  const { selected } = await inquirer.prompt<{ selected: string[] }>([
    {
      type: "checkbox",
      name: "selected",
      message: chalk.bold("Select components (Spacebar to toggle, Enter to confirm):"),
      choices: components.map((c) => {
        const tagPrefix = c.tag && c.tag !== "_general" ? `@${c.tag}/` : "";
        const suffix = c.structureOnly ? " (structure-only)" : "";
        return {
          name: `${tagPrefix}${c.name}${suffix}`,
          value: c.tag && c.tag !== "_general" ? `@${c.tag}/${c.name}` : c.name,
        };
      }),
    },
  ]);

  if (selected.length === 0) {
    return;
  }

  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: "list",
      name: "action",
      message: chalk.bold(`What would you like to do with the ${selected.length} selected component(s)?`),
      choices: [
        { name: "📥  Add to project", value: "add" },
        { name: "🗑️   Delete from library", value: "delete" },
        { name: "↩️   Back", value: "back" },
      ],
    },
  ]);

  if (action === "back") {
    return;
  }

  if (action === "delete") {
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: "confirm",
        name: "confirm",
        message: chalk.bold.red(`Are you sure you want to permanently delete these ${selected.length} component(s)?`),
        default: false,
      },
    ]);

    if (confirm) {
      for (const comp of selected) {
        await storageClient.remove(comp);
      }
      console.log(chalk.green("\n✓ Component(s) deleted successfully."));
      await inquirer.prompt([{ type: "input", name: "ok", message: "Press Enter to continue..." }]);
    }
    return;
  }

  if (action === "add") {
    const configExists = await configService.exists();
    const config = configExists ? await configService.read() : {};

    for (const fullName of selected) {
      console.log(chalk.cyan(`\nProcessing "${fullName}"...`));

      const isAlreadyImported = config.importedComponents && fullName in config.importedComponents;
      if (isAlreadyImported) {
        const overwrite = await askConfirmOverwrite(fullName);
        if (!overwrite) {
          console.log(chalk.yellow(`Skipped "${fullName}".`));
          continue;
        }
      }

      // Ask folder
      let dest = config.defaultImportPath;
      if (!dest) {
        dest = await askDestination(".");
      }

      const destinationDirAbsolutePath = path.resolve(process.cwd(), dest);

      try {
        const result = await addService.execute({ name: fullName, destinationDirAbsolutePath });

        const displayTag = result.metadata.tag && result.metadata.tag !== "_general" ? `@[${result.metadata.tag}]/` : "";
        console.log(chalk.green(`✓ "${displayTag}${result.metadata.name}" added.`));

        if (result.metadata.structureOnly) {
          console.log(chalk.dim(`  Created folder structure.`));
        } else {
          for (const file of result.writtenFiles) {
            console.log(chalk.dim(`  + ${path.relative(process.cwd(), file)}`));
          }
        }

        await configService.registerImport(fullName, result.metadata.tag, result.writtenFiles);

        if (result.missingDependencies.length > 0) {
          const depNames = result.missingDependencies.map((d) => d.name);
          const shouldInstall = await askConfirmInstallDeps(depNames);

          if (shouldInstall) {
            const pkgInfo = await fsClient.findNearestPackageJson(destinationDirAbsolutePath);
            if (pkgInfo) {
              const pkgJson = await fs.readJson(pkgInfo.path);
              pkgJson.dependencies = pkgJson.dependencies ?? {};
              for (const dep of result.missingDependencies) {
                pkgJson.dependencies[dep.name] = dep.version;
              }
              await fs.writeJson(pkgInfo.path, pkgJson, { spaces: 2 });
              console.log(chalk.green(`✓ Added dependencies to package.json.`));
            } else {
              console.log(chalk.yellow("⚠ No package.json found; install manually:"));
              for (const dep of result.missingDependencies) {
                console.log(chalk.dim(`  ${dep.name}: ${dep.version}`));
              }
            }
          }
        }
      } catch (error) {
        console.error(chalk.red(`✗ Failed: ${(error as Error).message}`));
      }
    }

    await inquirer.prompt([{ type: "input", name: "ok", message: "\nPress Enter to continue..." }]);
  }
}

async function manageVaultsFlow(vaults: VaultInfo[], vaultService: VaultService): Promise<void> {
  if (vaults.length === 0) {
    console.log(chalk.yellow("\nNo vaults stored yet. Save a component containing a .env file first!"));
    await inquirer.prompt([{ type: "input", name: "ok", message: "Press Enter to return..." }]);
    return;
  }

  const { vaultChoice } = await inquirer.prompt<{ vaultChoice: string }>([
    {
      type: "list",
      name: "vaultChoice",
      message: chalk.bold("Select a Vault to manage:"),
      choices: [
        ...vaults.map((v) => ({ name: `🔒  ${v.name}`, value: v.name })),
        { name: "↩️   Back", value: "back" },
      ],
    },
  ]);

  if (vaultChoice === "back") {
    return;
  }

  const selectedVault = vaults.find((v) => v.name === vaultChoice)!;

  const { vaultAction } = await inquirer.prompt<{ vaultAction: string }>([
    {
      type: "list",
      name: "vaultAction",
      message: chalk.bold(`Manage Vault "${selectedVault.name}":`),
      choices: [
        { name: "📥  Import all variables to project .env", value: "import_all" },
        { name: "🔍  Select specific variables to import", value: "import_some" },
        { name: "🗑️   Delete Vault", value: "delete" },
        { name: "↩️   Back", value: "back" },
      ],
    },
  ]);

  if (vaultAction === "back") {
    return;
  }

  if (vaultAction === "delete") {
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: "confirm",
        name: "confirm",
        message: chalk.bold.red(`Are you sure you want to permanently delete Vault "${selectedVault.name}"?`),
        default: false,
      },
    ]);

    if (confirm) {
      await vaultService.removeVault(selectedVault.name);
      console.log(chalk.green("\n✓ Vault deleted successfully."));
      await inquirer.prompt([{ type: "input", name: "ok", message: "Press Enter to continue..." }]);
    }
    return;
  }

  let varsToImport: Record<string, string> = {};

  if (vaultAction === "import_all") {
    varsToImport = selectedVault.variables;
  } else if (vaultAction === "import_some") {
    const { selectedKeys } = await inquirer.prompt<{ selectedKeys: string[] }>([
      {
        type: "checkbox",
        name: "selectedKeys",
        message: chalk.bold("Select environment variables to import (Spacebar to toggle):"),
        choices: Object.entries(selectedVault.variables).map(([k, v]) => ({
          name: `${k}=${v.replace(/./g, "*")}`,
          value: k,
        })),
      },
    ]);

    if (selectedKeys.length === 0) {
      return;
    }

    for (const key of selectedKeys) {
      const val = selectedVault.variables[key];
      if (val !== undefined) {
        varsToImport[key] = val;
      }
    }
  }

  const { envPath } = await inquirer.prompt<{ envPath: string }>([
    {
      type: "input",
      name: "envPath",
      message: chalk.bold("Destination file path:"),
      default: ".env",
    },
  ]);

  const targetEnvFile = path.resolve(process.cwd(), envPath);
  try {
    await vaultService.mergeVariables(targetEnvFile, varsToImport);
    console.log(chalk.green(`\n✓ Variables successfully imported to "${path.relative(process.cwd(), targetEnvFile)}".`));
  } catch (error) {
    console.error(chalk.red(`\n✗ Failed to import: ${(error as Error).message}`));
  }

  await inquirer.prompt([{ type: "input", name: "ok", message: "Press Enter to continue..." }]);
}
