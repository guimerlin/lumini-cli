import inquirer from "inquirer";
import type { SaveStrategy } from "../../core/entities/metadata.entity.js";
import chalk from "chalk";

export async function askStrategy(hasLocalImports: boolean, isDir: boolean): Promise<SaveStrategy> {
  const icon = isDir ? chalk.bold.blue("[Folder] ") : chalk.bold.cyan("[File] ");
  const { strategy } = await inquirer.prompt<{ strategy: SaveStrategy }>([
    {
      type: "list",
      name: "strategy",
      prefix: icon,
      message: chalk.bold("How would you like to save this component?"),
      choices: [
        {
          name: "Raw - Saves only the target file as is (ignores relative imports)",
          value: "raw",
        },
        {
          name: "Deps - Saves the target file + external dependencies manifest (npm)",
          value: "deps",
        },
        {
          name: "Bundle - Bundles all relative imports into a single file",
          value: "bundle",
          disabled: hasLocalImports ? false : "no relative imports to bundle",
        },
        {
          name: "Folder - Keeps/transforms target as folder, copies relative imports",
          value: "folder",
          disabled: hasLocalImports ? false : "no relative imports to copy",
        },
      ],
      default: hasLocalImports ? "folder" : "raw",
    },
  ]);

  return strategy;
}

export async function askComponentName(defaultName: string, isDir: boolean): Promise<string> {
  const icon = isDir ? chalk.bold.blue("[Folder] ") : chalk.bold.cyan("[File] ");
  const { name } = await inquirer.prompt<{ name: string }>([
    {
      type: "input",
      name: "name",
      prefix: icon,
      message: chalk.bold("Component name in the library:"),
      default: defaultName,
      validate: (value: string) => (value.trim().length > 0 ? true : "Name cannot be empty."),
    },
  ]);
  return name.trim();
}

export async function askTag(existingTags: string[], isDir: boolean): Promise<string> {
  const icon = isDir ? chalk.bold.blue("[Folder] ") : chalk.bold.cyan("[File] ");
  const choices = [
    { name: chalk.green("+ Create a new tag"), value: "__create_new__" },
    { name: chalk.dim("No tag (save to _general)"), value: "_general" },
    ...existingTags.filter((t) => t !== "_general").map((t) => ({ name: `@${t}`, value: t })),
  ];

  const { tagChoice } = await inquirer.prompt<{ tagChoice: string }>([
    {
      type: "list",
      name: "tagChoice",
      prefix: icon,
      message: chalk.bold("Choose or create a tag for this component:"),
      choices,
    },
  ]);

  if (tagChoice === "__create_new__") {
    const { newTag } = await inquirer.prompt<{ newTag: string }>([
      {
        type: "input",
        name: "newTag",
        prefix: icon,
        message: chalk.bold("Enter the new tag name (alphanumeric/dashes only):"),
        validate: (value: string) => {
          const clean = value.trim();
          if (clean.length === 0) return "Tag name cannot be empty.";
          if (!/^[a-zA-Z0-9-_]+$/.test(clean)) {
            return "Tag must contain only alphanumeric characters, dashes, or underscores.";
          }
          if (clean === "_general") return "Tag cannot be '_general'.";
          return true;
        },
      }
    ]);
    return newTag.trim();
  }

  return tagChoice;
}

export async function askEnvVaultOption(envFilename: string): Promise<"vault" | "file" | "ignore"> {
  const { option } = await inquirer.prompt<{ option: "vault" | "file" | "ignore" }>([
    {
      type: "list",
      name: "option",
      prefix: chalk.bold.yellow("[Vault] "),
      message: chalk.bold(`We found environment variables in "${envFilename}". How would you like to handle it?`),
      choices: [
        {
          name: "Save as a secure Vault (recommended for API keys/secrets)",
          value: "vault",
        },
        {
          name: "Save directly as a file inside the component folder",
          value: "file",
        },
        {
          name: "Ignore (do not save this file)",
          value: "ignore",
        },
      ],
    },
  ]);
  return option;
}

export async function askVaultName(defaultName: string): Promise<string> {
  const { vaultName } = await inquirer.prompt<{ vaultName: string }>([
    {
      type: "input",
      name: "vaultName",
      prefix: chalk.bold.yellow("[Vault] "),
      message: chalk.bold("Enter the name for this vault:"),
      default: defaultName,
      validate: (value: string) => {
        const clean = value.trim();
        if (clean.length === 0) return "Vault name cannot be empty.";
        if (!/^[a-zA-Z0-9-_]+$/.test(clean)) {
          return "Vault name must contain only alphanumeric characters, dashes, or underscores.";
        }
        return true;
      },
    },
  ]);
  return vaultName.trim();
}

export async function askSaveEnvChoice(envFilename: string, isFolder: boolean): Promise<"vault" | "library"> {
  const targetDesc = isFolder ? "these .env files" : `"${envFilename}"`;
  const { choice } = await inquirer.prompt<{ choice: "vault" | "library" }>([
    {
      type: "list",
      name: "choice",
      prefix: chalk.bold.yellow("[Vault] "),
      message: chalk.bold(`We found only environment variables in ${targetDesc}. How would you like to save?`),
      choices: [
        {
          name: `Save as a secure Vault (recommended for secrets)`,
          value: "vault",
        },
        {
          name: `Save as a regular component in the library`,
          value: "library",
        },
      ],
    },
  ]);
  return choice;
}
