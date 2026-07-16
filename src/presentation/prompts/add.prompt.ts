import inquirer from "inquirer";

export async function askDestination(defaultDir: string): Promise<string> {
  const { destination } = await inquirer.prompt<{ destination: string }>([
    {
      type: "input",
      name: "destination",
      message: "Em qual pasta o componente deve ser inserido?",
      default: defaultDir,
    },
  ]);
  return destination;
}

export async function askConfirmInstallDeps(deps: string[]): Promise<boolean> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      message: `Faltam ${deps.length} dependência(s) no seu package.json (${deps.join(
        ", ",
      )}). Adicionar ao package.json agora?`,
      default: true,
    },
  ]);
  return confirm;
}
