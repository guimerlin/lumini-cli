import chalk from "chalk";
import { Command } from "commander";
import { StorageClient } from "../../infrastructure/clients/storage.client.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("Lista os componentes salvos na biblioteca")
    .action(async () => {
      const storageClient = new StorageClient();
      const components = await storageClient.list();

      if (components.length === 0) {
        console.log(chalk.dim("Nenhum componente salvo ainda. Use `lumini save <caminho>`."));
        return;
      }

      for (const c of components) {
        console.log(
          `${chalk.bold(c.name)} ${chalk.dim(`(${c.strategy}${c.isDirectory ? ", pasta" : ""})`)}`,
        );
      }
    });
}
