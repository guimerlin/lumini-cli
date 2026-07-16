#!/usr/bin/env node
import { Command } from "commander";
import { registerSaveCommand } from "./commands/save.command.js";
import { registerAddCommand } from "./commands/add.command.js";
import { registerListCommand } from "./commands/list.command.js";

const program = new Command();

program
  .name("lumini")
  .description(
    "Coleta, organiza e reutiliza componentes de código com resolução inteligente de dependências via AST.",
  )
  .version("0.1.0");

registerSaveCommand(program);
registerAddCommand(program);
registerListCommand(program);

program.parseAsync(process.argv);
