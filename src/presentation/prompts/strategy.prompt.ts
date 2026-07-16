import inquirer from "inquirer";
import type { SaveStrategy } from "../../core/entities/metadata.entity.js";

export async function askStrategy(hasLocalImports: boolean): Promise<SaveStrategy> {
  if (!hasLocalImports) {
    // Sem imports locais, Raw e Deps se equivalem em resultado prático (Deps só
    // muda o comportamento do `add`); ainda perguntamos, mas com Raw como default.
  }

  const { strategy } = await inquirer.prompt<{ strategy: SaveStrategy }>([
    {
      type: "list",
      name: "strategy",
      message: "Como você quer salvar este componente?",
      choices: [
        {
          name: "Raw — salva só o arquivo, como está (ignora imports locais)",
          value: "raw",
        },
        {
          name: "Deps — salva o arquivo + manifesto de dependências externas (npm)",
          value: "deps",
        },
        {
          name: "Bundle — injeta os arquivos locais importados no mesmo arquivo",
          value: "bundle",
          disabled: hasLocalImports ? false : "sem imports locais para injetar",
        },
        {
          name: "Folder — transforma em pasta e copia os arquivos locais importados",
          value: "folder",
          disabled: hasLocalImports ? false : "sem imports locais para copiar",
        },
      ],
      default: hasLocalImports ? "folder" : "raw",
    },
  ]);

  return strategy;
}

export async function askComponentName(defaultName: string): Promise<string> {
  const { name } = await inquirer.prompt<{ name: string }>([
    {
      type: "input",
      name: "name",
      message: "Nome para salvar este componente na biblioteca:",
      default: defaultName,
      validate: (value: string) => (value.trim().length > 0 ? true : "O nome não pode ser vazio."),
    },
  ]);
  return name.trim();
}
