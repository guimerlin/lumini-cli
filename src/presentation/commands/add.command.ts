import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { FileSystemClient } from "../../infrastructure/clients/file-system.client.js";
import { StorageClient } from "../../infrastructure/clients/storage.client.js";
import { AddComponentService } from "../../core/services/add-component.service.js";
import { askConfirmInstallDeps, askDestination } from "../prompts/add.prompt.js";
import fs from "fs-extra";

export function registerAddCommand(program: Command): void {
  program
    .command("add <nome>")
    .description("Injeta um componente salvo previamente no diretório atual")
    .option("-d, --dest <pasta>", "pasta de destino (padrão: diretório atual)")
    .action(async (nome: string, options: { dest?: string }) => {
      const fsClient = new FileSystemClient();
      const storageClient = new StorageClient();
      const addService = new AddComponentService(storageClient, fsClient);

      if (!(await storageClient.exists(nome))) {
        console.error(
          chalk.red(`✗ Componente "${nome}" não existe na biblioteca. Rode "lumini list" para ver os salvos.`),
        );
        process.exitCode = 1;
        return;
      }

      const destinationDirAbsolutePath = path.resolve(
        process.cwd(),
        options.dest ?? (await askDestination(".")),
      );

      try {
        const result = await addService.execute({ name: nome, destinationDirAbsolutePath });

        console.log(chalk.green(`✓ "${nome}" adicionado.`));
        for (const file of result.writtenFiles) {
          console.log(chalk.dim(`  + ${path.relative(process.cwd(), file)}`));
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
              console.log(
                chalk.green(`✓ Adicionado ao package.json (rode seu instalador: npm/pnpm/yarn install).`),
              );
            } else {
              console.log(
                chalk.yellow("⚠ Nenhum package.json encontrado a partir do destino; adicione manualmente:"),
              );
              for (const dep of result.missingDependencies) {
                console.log(chalk.dim(`  ${dep.name}: ${dep.version}`));
              }
            }
          } else {
            console.log(chalk.yellow("⚠ Lembre-se de instalar manualmente:"));
            for (const dep of result.missingDependencies) {
              console.log(chalk.dim(`  ${dep.name}: ${dep.version}`));
            }
          }
        }
      } catch (error) {
        console.error(chalk.red(`✗ Falha ao adicionar: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    });
}
