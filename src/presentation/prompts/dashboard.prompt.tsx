import chalk from "chalk";
import path from "node:path";
import fs from "fs-extra";
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
import {
  askImportLinkedVault,
  askLinkedVaultImportType,
  askSelectVaultKeys,
  runVaultImportFlow,
} from "./vault-import.prompt.js";
import { askSelect, askMultiSelect, askConfirm, askInput, printDashboardHeader } from "../ink/prompts.js";

export async function runInteractiveDashboard(): Promise<void> {
  const fsClient = new FileSystemClient();
  const storageClient = new StorageClient();
  const addService = new AddComponentService(storageClient, fsClient);
  const configService = new ConfigService(fsClient);
  const vaultService = new VaultService(fsClient);

  while (true) {
    printDashboardHeader();

    const vaults = await vaultService.listVaults();
    if (vaults.length > 0) {
      console.log(chalk.bold.yellow("[Vaults]"));
      for (const vault of vaults) {
        console.log(`  * ${chalk.bold(vault.name)}:`);
        for (const key of Object.keys(vault.variables)) {
          console.log(`    - ${key}=******`);
        }
      }
      console.log();
    } else {
      console.log(chalk.dim("  No Vaults stored yet.\n"));
    }

    const components = await storageClient.list();
    if (components.length > 0) {
      console.log(chalk.bold.cyan("[Components]"));
      for (const comp of components) {
        const tagDisplay = comp.tag && comp.tag !== "_general" ? chalk.cyan(`@${comp.tag}/`) : "";
        const struct = comp.structureOnly ? chalk.gray(" (structure-only)") : "";
        console.log(`  * ${tagDisplay}${chalk.bold(comp.name)}${struct}`);
      }
      console.log();
    } else {
      console.log(chalk.dim("  No components saved yet.\n"));
    }

    const action = await askSelect("Select an action:", [
      { label: "Manage Components", value: "components" },
      { label: "Manage Vaults", value: "vaults" },
      { label: "Exit", value: "exit" },
    ]);

    if (action === "exit") {
      console.log(chalk.cyan("Goodbye!"));
      break;
    }

    if (action === "components") {
      await manageComponentsFlow(components, storageClient, addService, configService, fsClient);
    } else if (action === "vaults") {
      await manageVaultsFlow(vaults, vaultService, configService);
    }
  }
}

async function manageComponentsFlow(
  components: any[],
  storageClient: StorageClient,
  addService: AddComponentService,
  configService: ConfigService,
  fsClient: FileSystemClient,
): Promise<void> {
  if (components.length === 0) {
    console.log(chalk.yellow("\nNo components saved yet. Save a component first!"));
    await askInput("Press Enter to return...");
    return;
  }

  const selected = await askMultiSelect(
    "Select components:",
    components.map((c) => {
      const tagPrefix = c.tag && c.tag !== "_general" ? `@${c.tag}/` : "";
      const suffix = c.structureOnly ? " (structure-only)" : "";
      return {
        label: `${tagPrefix}${c.name}${suffix}`,
        value: c.tag && c.tag !== "_general" ? `@${c.tag}/${c.name}` : c.name,
      };
    })
  );

  if (selected.length === 0) {
    return;
  }

  const action = await askSelect(
    `What would you like to do with the ${selected.length} selected component(s)?`,
    [
      { label: "Add to project", value: "add" },
      { label: "Delete from library", value: "delete" },
      { label: "Back", value: "back" },
    ]
  );

  if (action === "back") {
    return;
  }

  if (action === "delete") {
    const confirm = await askConfirm(`Are you sure you want to permanently delete these ${selected.length} component(s)?`, false);

    if (confirm) {
      for (const comp of selected) {
        await storageClient.remove(comp);
      }
      console.log(chalk.green("\n[Success] Component(s) deleted successfully."));
      await askInput("Press Enter to continue...");
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

      let dest = config.defaultImportPath;
      if (!dest) {
        dest = await askDestination(".");
      }

      const destinationDirAbsolutePath = path.resolve(process.cwd(), dest);

      try {
        const result = await addService.execute({ name: fullName, destinationDirAbsolutePath });

        const displayTag = result.metadata.tag && result.metadata.tag !== "_general" ? `@[${result.metadata.tag}]/` : "";
        console.log(chalk.green(`[Success] "${displayTag}${result.metadata.name}" added.`));

        if (result.metadata.structureOnly) {
          console.log(chalk.dim(`  Created folder structure.`));
        } else {
          for (const file of result.writtenFiles) {
            console.log(chalk.dim(`  + ${path.relative(process.cwd(), file)}`));
          }
        }

        await configService.registerImport(fullName, result.metadata.tag, result.writtenFiles);

        if (result.metadata.associatedVault) {
          const vaultName = result.metadata.associatedVault;
          const vaultService = new VaultService(fsClient);
          const vaults = await vaultService.listVaults();
          const targetVault = vaults.find((v) => v.name === vaultName);
          
          if (targetVault) {
            const shouldImport = await askImportLinkedVault(vaultName);
            if (shouldImport) {
              let varsToImport = targetVault.variables;
              const alreadyImportedKeys = config.importedVaults?.[vaultName] ?? [];

              const importType = await askLinkedVaultImportType();
              if (importType === "select") {
                const selectedKeys = await askSelectVaultKeys(targetVault.variables, alreadyImportedKeys);
                varsToImport = {};
                for (const key of selectedKeys) {
                  varsToImport[key] = targetVault.variables[key] as string;
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
                  false,
                );
                if (success) {
                  console.log(chalk.green(`[Vault] Successfully imported variables from Vault "${vaultName}".`));
                }
              }
            }
          }
        }

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
              console.log(chalk.green(`[Success] Added dependencies to package.json.`));
            } else {
              console.log(chalk.yellow("[Warning] No package.json found; install manually:"));
              for (const dep of result.missingDependencies) {
                console.log(chalk.dim(`  ${dep.name}: ${dep.version}`));
              }
            }
          }
        }
      } catch (error) {
        console.error(chalk.red(`[Error] Failed: ${(error as Error).message}`));
      }
    }

    await askInput("Press Enter to continue...");
  }
}

async function manageVaultsFlow(
  vaults: VaultInfo[],
  vaultService: VaultService,
  configService: ConfigService,
): Promise<void> {
  if (vaults.length === 0) {
    console.log(chalk.yellow("\nNo vaults stored yet. Save a component containing a .env file first!"));
    await askInput("Press Enter to return...");
    return;
  }

  const vaultChoice = await askSelect(
    "Select a Vault to manage:",
    [
      ...vaults.map((v) => ({ label: `Vault: ${v.name}`, value: v.name })),
      { label: "Back", value: "back" },
    ]
  );

  if (vaultChoice === "back") {
    return;
  }

  const selectedVault = vaults.find((v) => v.name === vaultChoice)!;

  const vaultAction = await askSelect(
    `Manage Vault "${selectedVault.name}":`,
    [
      { label: "Import all variables to project .env", value: "import_all" },
      { label: "Select specific variables to import", value: "import_some" },
      { label: "Delete Vault", value: "delete" },
      { label: "Back", value: "back" },
    ]
  );

  if (vaultAction === "back") {
    return;
  }

  if (vaultAction === "delete") {
    const confirm = await askConfirm(`Are you sure you want to permanently delete Vault "${selectedVault.name}"?`, false);

    if (confirm) {
      await vaultService.removeVault(selectedVault.name);
      console.log(chalk.green("\n[Success] Vault deleted successfully."));
      await askInput("Press Enter to continue...");
    }
    return;
  }

  let varsToImport: Record<string, string> = {};

  if (vaultAction === "import_all") {
    varsToImport = selectedVault.variables;
  } else if (vaultAction === "import_some") {
    const config = await configService.read();
    const alreadyImportedKeys = config.importedVaults?.[selectedVault.name] ?? [];
    const selectedKeys = await askSelectVaultKeys(selectedVault.variables, alreadyImportedKeys);

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

  const envPath = await askInput("Destination file path:", ".env");

  const targetEnvFile = path.resolve(process.cwd(), envPath);
  try {
    const success = await runVaultImportFlow(
      selectedVault.name,
      varsToImport,
      targetEnvFile,
      configService,
      vaultService,
      false,
    );
    if (success) {
      console.log(chalk.green(`\n[Success] Variables successfully imported to "${path.relative(process.cwd(), targetEnvFile)}".`));
    }
  } catch (error) {
    console.error(chalk.red(`\n[Error] Failed to import: ${(error as Error).message}`));
  }

  await askInput("Press Enter to continue...");
}
