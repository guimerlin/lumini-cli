import inquirer from "inquirer";
import chalk from "chalk";

export async function askDestination(defaultDir: string): Promise<string> {
  const { destination } = await inquirer.prompt<{ destination: string }>([
    {
      type: "input",
      name: "destination",
      prefix: chalk.bold.blue("[Folder] "),
      message: chalk.bold("In which folder should the component be placed?"),
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
      prefix: chalk.bold.yellow("[Warning] "),
      message: chalk.bold(
        `Your package.json is missing ${deps.length} external dependency(ies): ${deps.join(
          ", ",
        )}. Add them now?`
      ),
      default: true,
    },
  ]);
  return confirm;
}

export async function askConfirmOverwrite(name: string): Promise<boolean> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      prefix: chalk.bold.yellow("[Warning] "),
      message: chalk.bold(`Component "${name}" is already imported in this project. Overwrite?`),
      default: false,
    },
  ]);
  return confirm;
}

export async function askInitConfig(): Promise<boolean> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      prefix: chalk.bold.cyan("[Config] "),
      message: chalk.bold("No .lumini configuration file found in this project. Initialize one now?"),
      default: true,
    },
  ]);
  return confirm;
}
