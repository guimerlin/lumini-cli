import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { FileSystemClient } from "../../infrastructure/clients/file-system.client.js";
import { VaultService } from "../../core/services/vault.service.js";
import { ConfigService } from "../../core/services/config.service.js";
import {
  askSelectVaultKeys,
  runVaultImportFlow,
} from "../prompts/vault-import.prompt.js";

export function registerVaultCommand(program: Command): void {
  const vaultCmd = program
    .command("vault")
    .description("Manage secure environment variable Vaults");

  vaultCmd
    .command("list")
    .description("List all stored Vaults")
    .action(async () => {
      const fsClient = new FileSystemClient();
      const vaultService = new VaultService(fsClient);

      const vaults = await vaultService.listVaults();
      if (vaults.length === 0) {
        console.log(chalk.dim("No Vaults stored yet."));
        return;
      }

      console.log(chalk.bold("\nStored Vaults:"));
      for (const vault of vaults) {
        console.log(`\n  ${chalk.bold.cyan(vault.name)}:`);
        for (const key of Object.keys(vault.variables)) {
          console.log(`    ${key}=******`);
        }
      }
      console.log();
    });

  vaultCmd
    .command("create <name> <path>")
    .description("Create a new Vault from a local .env file")
    .action(async (name: string, envPath: string) => {
      const fsClient = new FileSystemClient();
      const vaultService = new VaultService(fsClient);

      const absolutePath = path.resolve(process.cwd(), envPath);
      if (!(await fsClient.exists(absolutePath))) {
        console.error(chalk.red(`[Error] File not found: ${absolutePath}`));
        process.exitCode = 1;
        return;
      }

      try {
        const envContent = await fsClient.readFile(absolutePath);
        const parsedVars = vaultService.parseEnv(envContent);
        await vaultService.saveVault(name, parsedVars);
        console.log(chalk.green(`[Success] Vault "${name}" successfully created from "${envPath}".`));
      } catch (error) {
        console.error(chalk.red(`[Error] Failed to create Vault: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    });

  vaultCmd
    .command("import <name> [keys...]")
    .description("Import environment variables from a Vault into the project's .env file")
    .option("-d, --dest <path>", "destination file path (default: .env)")
    .option("-y, --yes", "auto-confirm overwrites")
    .action(async (name: string, keys: string[], options: { dest?: string; yes?: boolean }) => {
      const fsClient = new FileSystemClient();
      const vaultService = new VaultService(fsClient);
      const configService = new ConfigService(fsClient);

      const vaults = await vaultService.listVaults();
      const targetVault = vaults.find((v) => v.name === name);

      if (!targetVault) {
        console.error(chalk.red(`[Error] Vault "${name}" not found.`));
        process.exitCode = 1;
        return;
      }

      let varsToImport = targetVault.variables;
      const destPath = path.resolve(process.cwd(), options.dest ?? ".env");

      if (keys && keys.length > 0) {
        varsToImport = {};
        for (const key of keys) {
          if (key in targetVault.variables) {
            varsToImport[key] = targetVault.variables[key] as string;
          } else {
            console.warn(chalk.yellow(`[Warning] Variable "${key}" not found in Vault "${name}". Skipping.`));
          }
        }
      } else if (!options.yes) {
        const config = await configService.read();
        const alreadyImportedKeys = config.importedVaults?.[name] ?? [];
        const selectedKeys = await askSelectVaultKeys(targetVault.variables, alreadyImportedKeys);
        
        if (selectedKeys.length === 0) {
          console.log(chalk.yellow("No variables selected. Aborted."));
          return;
        }
        
        varsToImport = {};
        for (const key of selectedKeys) {
          varsToImport[key] = targetVault.variables[key] as string;
        }
      }

      try {
        const success = await runVaultImportFlow(
          name,
          varsToImport,
          destPath,
          configService,
          vaultService,
          options.yes,
        );
        if (success) {
          console.log(chalk.green(`[Success] Imported variables from Vault "${name}" into "${path.relative(process.cwd(), destPath)}".`));
        }
      } catch (error) {
        console.error(chalk.red(`[Error] Failed to import variables: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    });

  vaultCmd
    .command("delete <name>")
    .description("Delete a stored Vault")
    .action(async (name: string) => {
      const fsClient = new FileSystemClient();
      const vaultService = new VaultService(fsClient);

      const vaults = await vaultService.listVaults();
      const exists = vaults.some((v) => v.name === name);

      if (!exists) {
        console.error(chalk.red(`[Error] Vault "${name}" not found.`));
        process.exitCode = 1;
        return;
      }

      try {
        await vaultService.removeVault(name);
        console.log(chalk.green(`[Success] Vault "${name}" successfully deleted.`));
      } catch (error) {
        console.error(chalk.red(`[Error] Failed to delete Vault: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    });
}
