import { Command } from "commander";
import { saveCommandAction } from "./commands/save.js";
import { addCommandAction } from "./commands/add.js";

const program = new Command();

program
  .name("lumini")
  .description("O seu colecionador e organizador inteligente de código")
  .version("1.0.0");

program
  .command("save")
  .description("Salva um componente ou pasta no repositório Lumini")
  .argument("<caminho>", "Caminho para o componente ou pasta")
  .action(saveCommandAction);

program
  .command("add")
  .description("Adiciona um componente salvo ao projeto atual")
  .argument("<nome>", "Nome do componente salvo")
  .action(addCommandAction);

program.parse(process.argv);
