import chalk from "chalk";
import path from "node:path";
import fs from "fs-extra";
import type { ConfigService } from "../../core/services/config.service.js";
import type { VaultService } from "../../core/services/vault.service.js";
import { askSelect, askMultiSelect, askConfirm } from "../ink/prompts.js";

export async function askVariableConflict(
  key: string,
  currentValue: string,
  newValue: string,
): Promise<"overwrite" | "skip" | "cancel"> {
  return await askSelect(
    `[Conflict] Variable "${key}" already exists with value "${currentValue.replace(/./g, "*")}" (new value: "${newValue.replace(/./g, "*")}"). What to do?`,
    [
      { label: "Overwrite (replace old value)", value: "overwrite" },
      { label: "Skip (keep old value)", value: "skip" },
      { label: "Cancel entire operation", value: "cancel" },
    ]
  ) as "overwrite" | "skip" | "cancel";
}

export async function askImportLinkedVault(vaultName: string): Promise<boolean> {
  return await askConfirm(`[Vault] This component is linked to Vault "${vaultName}". Would you like to import its variables?`, true);
}

export async function askLinkedVaultImportType(): Promise<"all" | "select"> {
  return await askSelect(
    "[Vault] How would you like to import the variables?",
    [
      { label: "Import all variables", value: "all" },
      { label: "Select specific variables to import", value: "select" },
    ]
  ) as "all" | "select";
}

export async function askSelectVaultKeys(
  variables: Record<string, string>,
  alreadyImportedKeys: string[],
): Promise<string[]> {
  const choices = Object.entries(variables).map(([k, v]) => {
    const isImported = alreadyImportedKeys.includes(k);
    const nameSuffix = isImported ? " (already imported)" : "";
    return {
      label: `${k}=${v.replace(/./g, "*")}${nameSuffix}`,
      value: k,
    };
  });

  return await askMultiSelect(
    "[Vault] Select environment variables to import (Spacebar to toggle):",
    choices
  );
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

  const overlap = Object.keys(variables).filter((k) => alreadyImported.includes(k));
  if (overlap.length > 0 && !yesMode) {
    console.log(
      chalk.cyan(`[Info] Note: The following variables were already imported in this project: ${overlap.join(", ")}`)
    );
  }

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
