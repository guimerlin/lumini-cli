import os from "node:os";
import path from "node:path";
import type { IFileSystemClient } from "../interfaces/file-system-client.interface.js";

const VAULT_ROOT = path.join(os.homedir(), ".lumini", "vault");

export interface VaultInfo {
  name: string;
  variables: Record<string, string>;
}

export class VaultService {
  constructor(private readonly fsClient: IFileSystemClient) {}

  private getVaultPath(vaultName: string): string {
    return path.join(VAULT_ROOT, vaultName, ".env");
  }

  async saveVault(vaultName: string, variables: Record<string, string>): Promise<void> {
    const vaultPath = this.getVaultPath(vaultName);
    const content = Object.entries(variables)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    await this.fsClient.writeFile(vaultPath, content);
  }

  async listVaults(): Promise<VaultInfo[]> {
    const exists = await this.fsClient.exists(VAULT_ROOT);
    if (!exists) return [];

    // Note: IFileSystemClient doesn't expose listDirectories directly for VAULT_ROOT,
    // but we can read it recursively or check subdirectories. To keep it decoupled,
    // we can use listFilesRecursively(VAULT_ROOT, ["*"]) which is robust!
    // Since each vault contains a .env file, we search for files named ".env" or similar.
    const allFiles = await this.fsClient.listFilesRecursively(VAULT_ROOT, ["*"]);
    const vaults: Record<string, Record<string, string>> = {};

    for (const file of allFiles) {
      if (path.basename(file) === ".env") {
        const vaultName = path.basename(path.dirname(file));
        const content = await this.fsClient.readFile(file);
        vaults[vaultName] = this.parseEnv(content);
      }
    }

    return Object.entries(vaults).map(([name, variables]) => ({
      name,
      variables,
    }));
  }

  async removeVault(vaultName: string): Promise<void> {
    const vaultPath = this.getVaultPath(vaultName);
    const dir = path.dirname(vaultPath);
    // Note: we can use a custom remove, but since IFileSystemClient doesn't expose remove/delete,
    // we can use imports from fs-extra or check if we can write an empty file/delete it.
    // Wait, let's import fs-extra inside the infrastructure or use it directly here.
    // To stay compliant with clean layers, let's write to it or use fs-extra directly,
    // or add delete methods. Wait, StorageClient uses fs-extra.remove. So doing it directly is fine,
    // but let's check if we can import fs-extra. Yes!
    const fs = await import("fs-extra");
    await fs.default.remove(dir);
  }

  async mergeVariables(destEnvPath: string, variables: Record<string, string>): Promise<void> {
    let existingVars: Record<string, string> = {};
    if (await this.fsClient.exists(destEnvPath)) {
      const content = await this.fsClient.readFile(destEnvPath);
      existingVars = this.parseEnv(content);
    }

    const merged = { ...existingVars, ...variables };
    const content = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    await this.fsClient.writeFile(destEnvPath, content);
  }

  parseEnv(content: string): Record<string, string> {
    const vars: Record<string, string> = {};
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        vars[key] = value;
      }
    }
    return vars;
  }
}
