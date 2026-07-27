import "dotenv/config";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "commander";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const program = new Command();
program
    .name("lumini")
    .description("Lumini CLI — Seu canivete suíço pessoal")
    .version("1.0.0");
const COMMANDS_DIR = join(__dirname, "commands");
/**
 * Varre o diretório de comandos recursivamente
 */
function getCommandFiles(dir) {
    let files = [];
    if (!existsSync(dir))
        return files;
    const list = readdirSync(dir);
    for (const file of list) {
        const filePath = join(dir, file);
        const stat = statSync(filePath);
        if (stat && stat.isDirectory()) {
            files = files.concat(getCommandFiles(filePath));
        }
        else {
            const ext = extname(file);
            if ((ext === ".js" || ext === ".ts") && !file.endsWith(".d.ts")) {
                files.push(filePath);
            }
        }
    }
    return files;
}
/**
 * Registra os comandos no Commander dinamicamente
 */
async function loadCommands() {
    const files = getCommandFiles(COMMANDS_DIR);
    for (const filePath of files) {
        // Transforma o caminho relativo em uma hierarquia de subcomandos
        // Ex: "repo/commit.ts" -> ["repo", "commit"]
        const relativePath = relative(COMMANDS_DIR, filePath);
        const ext = extname(filePath);
        const parts = relativePath.substring(0, relativePath.length - ext.length).split("/");
        // Importação dinâmica do módulo (convertendo para URL de arquivo válida no ESModule)
        const fileUrl = pathToFileURL(filePath).href;
        const module = await import(fileUrl);
        if (!module.command)
            continue;
        const cmdDef = module.command;
        // Navega ou cria a estrutura de subcomandos (ex: lumini -> repo -> commit)
        let parentGroup = program;
        for (let i = 0; i < parts.length - 1; i++) {
            const groupName = parts[i];
            let existingGroup = parentGroup.commands.find((c) => c.name() === groupName);
            if (!existingGroup) {
                existingGroup = parentGroup
                    .command(groupName)
                    .description(`Módulo de comandos para ${groupName}`);
            }
            parentGroup = existingGroup;
        }
        // Registra o comando final
        const cmdName = cmdDef.name || parts[parts.length - 1];
        const newCmd = parentGroup
            .command(cmdName)
            .description(cmdDef.description || "");
        // Registra as flags se existirem
        if (Array.isArray(cmdDef.flags)) {
            cmdDef.flags.forEach((flag) => {
                newCmd.option(flag.name, flag.description, flag.defaultValue);
            });
        }
        // Atribui a ação do comando
        newCmd.action(cmdDef.action);
    }
}
// Inicializa e executa o CLI
await loadCommands();
program.parse(process.argv);
