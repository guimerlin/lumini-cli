import { Command } from "commander";
import { registerSaveCommand } from "./commands/save.command.js";
import { registerAddCommand } from "./commands/add.command.js";
import { registerListCommand } from "./commands/list.command.js";
import { registerVaultCommand } from "./commands/vault.command.js";
import { render } from "ink";
import App from "./App.js";

const program = new Command();

program
  .name("lumini")
  .description(
    "Collect, organize, and reuse code components with AST-based dependency resolution.",
  )
  .version("0.1.0");

registerSaveCommand(program);
registerAddCommand(program);
registerListCommand(program);
registerVaultCommand(program);

if (process.argv.length <= 2) {
  const { waitUntilExit } = render(<App initialScreen="DASHBOARD" />);
  await waitUntilExit();
} else {
  await program.parseAsync(process.argv);
}

