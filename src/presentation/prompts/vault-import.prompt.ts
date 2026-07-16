import inquirer from "inquirer";
import chalk from "chalk";
import path from "node:path";
import fs from "fs-extra";
import type { ConfigService } from "../../core/services/config.service.js";
import type { VaultService } from "../../core/services/vault.service.js";

export async function askVariableConflict(
  key: string,
  currentValue: string,
  newValue: string,
): Promise<"overwrite" | "skip" | "cancel"> {
  const { choice } = await inquirer.prompt<{ choice: "overwrite" | "skip" | "cancel" }>([
    {
      type: "list",
      name: "choice",
      prefix: chalk.bold.yellow("[Conflict] "),
      message: chalk.bold(
        `Variable "${key}" already exists with value "${currentValue.replace(/./g, "*")}" (new value: "${newValue.replace(/./g, "*")}"). What to do?`
      ),
      choices: [
        { name: "Overwrite (replace old value)", value: "overwrite" },
        { name: "Skip (keep old value)", value: "skip" },
        { name: "Cancel entire operation", value: "cancel" },
      ],
    },
  ]);
  return choice;
}

export async function askImportLinkedVault(vaultName: string): Promise<boolean> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      prefix: chalk.bold.cyan("[Vault] "),
      message: chalk.bold(`This component is linked to Vault "${vaultName}". Would you like to import its variables?`),
      default: true,
    },
  ]);
  return confirm;
}

export async function askLinkedVaultImportType(): Promise<"all" | "select"> {
  const { choice } = await inquirer.prompt<{ choice: "all" | "select" }>([
    {
      type: "list",
      name: "choice",
      prefix: chalk.bold.cyan("[Vault] "),
      message: chalk.bold("How would you like to import the variables?"),
      choices: [
        { name: "Import all variables", value: "all" },
        { name: "Select specific variables to import", value: "select" },
      ],
    },
  ]);
  return choice;
}

export async function askSelectVaultKeys(
  variables: Record<string, string>,
  alreadyImportedKeys: string[],
): Promise<string[]> {
  const { selectedKeys } = await inquirer.prompt<{ selectedKeys: string[] }>([
    {
      type: "checkbox",
      name: "selectedKeys",
      prefix: chalk.bold.cyan("[Vault] "),
      message: chalk.bold("Select environment variables to import (Spacebar to toggle):"),
      choices: Object.entries(variables).map(([k, v]) => {
        const isImported = alreadyImportedKeys.includes(k);
        const nameSuffix = isImported ? chalk.dim(" (already imported)") : "";
        return {
          name: `${k}=${v.replace(/./g, "*")}${nameSuffix}`,
          value: k,
          checked: false,
        };
      }),
    },
  ]);
  return selectedKeys;
}

export async function runVaultImportFlow(
  vaultName: string,
  variables: Record<string, string>,
  destEnvPath: string,
  configService: ConfigService,
  vaultService: VaultService,
  yesMode = false,
): Promise<boolean> {
  const config = await configService.read();
  const alreadyImported = config.importedVaults?.[vaultName] ?? [];

  // If some keys are already imported, tell the user
  const overlap = Object.keys(variables).filter((k) => alreadyImported.includes(k));
  if (overlap.length > 0 && !yesMode) {
    console.log(
      chalk.cyan(`[Info] Note: The following variables were already imported in this project: ${overlap.join(", ")}`)
    );
  }

  // Load existing variables in destEnvPath
  let existingVars: Record<string, string> = {};
  if (await fs.pathExists(destEnvPath)) {
    const content = await fs.readFile(destEnvPath, "utf-8");
    existingVars = vaultService.parseEnv(content);
  }

  const varsToWrite: Record<string, string> = {};
  const importedKeys: string[] = [];

  for (const [key, value] of Object.entries(variables)) {
    if (key in existingVars) {
      if (existingVars[key] === value) {
        varsToWrite[key] = value;
        importedKeys.push(key);
        continue;
      }
      
      if (yesMode) {
        varsToWrite[key] = value;
        importedKeys.push(key);
      } else {
        const action = await askVariableConflict(key, existingVars[key] as string, value);
        if (action === "overwrite") {
          varsToWrite[key] = value;
          importedKeys.push(key);
        } else if (action === "skip") {
          varsToWrite[key] = existingVars[key] as string;
        } else {
          console.log(chalk.yellow("Import cancelled."));
          return false;
        }
      }
    } else {
      varsToWrite[key] = value;
      importedKeys.push(key);
    }
  }

  const finalVars = { ...existingVars, ...varsToWrite };
  const newContent = Object.entries(finalVars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";

  await fs.ensureDir(path.dirname(destEnvPath));
  await fs.writeFile(destEnvPath, newContent, "utf-8");

  await configService.registerVaultImport(vaultName, importedKeys);
  return true;
}
