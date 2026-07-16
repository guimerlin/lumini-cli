
import { askConfirm, askInput } from "../ink/prompts.js";

export async function askDestination(defaultDir: string): Promise<string> {
  return await askInput("[Folder] In which folder should the component be placed?", defaultDir);
}

export async function askConfirmInstallDeps(deps: string[]): Promise<boolean> {
  return await askConfirm(`[Warning] Your package.json is missing ${deps.length} external dependency(ies): ${deps.join(", ")}. Add them now?`, true);
}

export async function askConfirmOverwrite(name: string): Promise<boolean> {
  return await askConfirm(`[Warning] Component "${name}" is already imported in this project. Overwrite?`, false);
}

export async function askInitConfig(): Promise<boolean> {
  return await askConfirm("[Config] No .lumini configuration file found in this project. Initialize one now?", true);
}
