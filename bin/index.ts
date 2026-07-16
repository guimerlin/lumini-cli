#!/usr/bin/env node

import { Command } from "commander";
import prompts from "prompts";

const program = new Command();

program
  .name("lumini")
  .description("O seu colecionador e organizador inteligente de código")
  .version("1.0.0");

// Registrando o comando: lumini save <caminho>
program
  .command("save")
  .description("Salva um componente ou pasta no repositório Lumini")
  .argument("<caminho>", "Caminho para o componente ou pasta")
  .action(async (caminho) => {
    console.log(`[Lumini] Analisando o caminho: ${caminho}`);

    // Aqui nós rodaríamos a lógica que você desenhou!
    // Exemplo de Prompt interativo:
    const resposta = await prompts({
      type: "select",
      name: "estrategia",
      message: "Como você deseja tratar as dependências e imports locais?",
      choices: [
        { title: "Apenas o arquivo principal (ignorar imports)", value: "raw" },
        {
          title: "Arquivo principal + dependências do package.json",
          value: "deps",
        },
        { title: "Unir tudo em um único arquivo (Bundle)", value: "bundle" },
        {
          title: "Agrupar em uma pasta com sub-arquivos remapeados",
          value: "folder",
        },
      ],
    });

    console.log(`Estratégia escolhida: ${resposta.estrategia}`);
  });

program.parse(process.argv);
