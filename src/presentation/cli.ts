#!/usr/bin/env node
import { Command } from "commander";
import { registerSaveCommand } from "./commands/save.command.js";
import { registerAddCommand } from "./commands/add.command.js";
import { registerListCommand } from "./commands/list.command.js";
import { runInteractiveDashboard } from "./prompts/dashboard.prompt.js";

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

if (process.argv.length <= 2) {
  await runInteractiveDashboard();
} else {
  await program.parseAsync(process.argv);
}
