import chalk from "chalk";
import { Command } from "commander";
import { StorageClient } from "../../infrastructure/clients/storage.client.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("Lists saved components in the library")
    .action(async () => {
      const storageClient = new StorageClient();
      const components = await storageClient.list();

      if (components.length === 0) {
        console.log(chalk.dim("No components saved yet. Use `lumini save <path>`."));
        return;
      }

      const grouped: Record<string, typeof components> = {};
      for (const c of components) {
        const tag = c.tag || "_general";
        grouped[tag] = grouped[tag] ?? [];
        grouped[tag].push(c);
      }

      for (const [tag, comps] of Object.entries(grouped)) {
        const tagHeader = tag === "_general" ? "General components" : `@${tag}`;
        console.log(chalk.bold.cyan(`\n${tagHeader}:`));
        for (const c of comps) {
          const suffix = c.structureOnly
            ? ", structure-only"
            : ` (${c.strategy}${c.isDirectory ? ", folder" : ""})`;
          console.log(`  ${chalk.green(c.name)}${chalk.dim(suffix)}`);
        }
      }
      console.log();
    });
}
