
import type { SaveStrategy } from "../../core/entities/metadata.entity.js";
import { askSelect, askInput } from "../ink/prompts.js";

export async function askStrategy(hasLocalImports: boolean, isDir: boolean): Promise<SaveStrategy> {
  const icon = isDir ? "[Folder] " : "[File] ";

  const choices = [
    {
      label: "Raw - Saves only the target file as is (ignores relative imports)",
      value: "raw",
    },
    {
      label: "Deps - Saves the target file + external dependencies manifest (npm)",
      value: "deps",
    }
  ];

  if (hasLocalImports) {
    choices.push({
      label: "Bundle - Bundles all relative imports into a single file",
      value: "bundle",
    });
    choices.push({
      label: "Folder - Keeps/transforms target as folder, copies relative imports",
      value: "folder",
    });
  }

  const result = await askSelect(
    `${icon}How would you like to save this component?`,
    choices
  );

  return result as SaveStrategy;
}

export async function askComponentName(defaultName: string, isDir: boolean): Promise<string> {
  const icon = isDir ? "[Folder] " : "[File] ";
  let res = "";
  while (!res) {
      res = await askInput(`${icon}Component name in the library:`, defaultName);
      res = res.trim();
  }
  return res;
}

export async function askTag(existingTags: string[], isDir: boolean): Promise<string> {
  const icon = isDir ? "[Folder] " : "[File] ";
  const choices = [
    { label: "+ Create a new tag", value: "__create_new__" },
    { label: "No tag (save to _general)", value: "_general" },
    ...existingTags.filter((t) => t !== "_general").map((t) => ({ label: `@${t}`, value: t })),
  ];

  const tagChoice = await askSelect(
    `${icon}Choose or create a tag for this component:`,
    choices
  );

  if (tagChoice === "__create_new__") {
    let newTag = "";
    while (!newTag) {
        newTag = await askInput(`${icon}Enter the new tag name (alphanumeric/dashes only):`);
        newTag = newTag.trim();
        if (!/^[a-zA-Z0-9-_]+$/.test(newTag) || newTag === "_general") {
            newTag = "";
        }
    }
    return newTag;
  }

  return tagChoice;
}

export async function askEnvVaultOption(envFilename: string): Promise<"vault" | "file" | "ignore"> {
  return await askSelect(
    `[Vault] We found environment variables in "${envFilename}". How would you like to handle it?`,
    [
      { label: "Save as a secure Vault (recommended for API keys/secrets)", value: "vault" },
      { label: "Save directly as a file inside the component folder", value: "file" },
      { label: "Ignore (do not save this file)", value: "ignore" },
    ]
  ) as "vault" | "file" | "ignore";
}

export async function askVaultName(defaultName: string): Promise<string> {
  let vaultName = "";
  while (!vaultName) {
      vaultName = await askInput("[Vault] Enter the name for this vault:", defaultName);
      vaultName = vaultName.trim();
      if (!/^[a-zA-Z0-9-_]+$/.test(vaultName)) {
          vaultName = "";
      }
  }
  return vaultName;
}

export async function askSaveEnvChoice(envFilename: string, isFolder: boolean): Promise<"vault" | "library"> {
  const targetDesc = isFolder ? "these .env files" : `"${envFilename}"`;
  return await askSelect(
    `[Vault] We found only environment variables in ${targetDesc}. How would you like to save?`,
    [
      { label: `Save as a secure Vault (recommended for secrets)`, value: "vault" },
      { label: `Save as a regular component in the library`, value: "library" },
    ]
  ) as "vault" | "library";
}
