import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { defaultConfig } from "./defaults.js";

const GLOBAL_CONFIG_DIR = join(homedir(), ".lumini");
const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, "global.json");
const LOCAL_CONFIG_PATH = join(process.cwd(), ".lumini");

type ConfigScope = "local" | "global" | "all";

/**
 * Lê o arquivo de configuração, retornando um objeto.
 */
function readConfigFile(filePath: string): Record<string, any> {
  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content || "{}");
    } catch (err) {
      console.warn(
        `Aviso: Falha ao ler ou parsear o arquivo de configuração em ${filePath}. Assumindo vazio.`,
      );
      return {};
    }
  }
  return {};
}

/**
 * Escreve um objeto em um arquivo de configuração.
 */
function writeConfigFile(filePath: string, config: Record<string, any>): void {
  writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Garante que o diretório global ~/.lumini existe e cria o global.json caso não exista.
 */
function ensureGlobalConfig() {
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
  if (!existsSync(GLOBAL_CONFIG_PATH)) {
    writeConfigFile(GLOBAL_CONFIG_PATH, {});
  }
}

/**
 * Inicializa a configuração local (cria .lumini se não existir).
 */
export function initConfigs() {
  if (!existsSync(LOCAL_CONFIG_PATH)) {
    writeConfigFile(LOCAL_CONFIG_PATH, defaultConfig);
    console.log(`Arquivo de configuração local criado em ${LOCAL_CONFIG_PATH}`);
  } else {
    console.log(
      `Arquivo de configuração local já existe em ${LOCAL_CONFIG_PATH}`,
    );
  }
  ensureGlobalConfig();
}

/**
 * Pega um valor de configuração.
 * Se houver no local, usa o local. Se não, busca no global.
 * @param key Chave da configuração. Se não passada, retorna o objeto com a mescla de global + local.
 */
export function getConfig(key?: string): any {
  ensureGlobalConfig();

  const globalConfig = readConfigFile(GLOBAL_CONFIG_PATH);
  const localConfig = readConfigFile(LOCAL_CONFIG_PATH);

  if (key) {
    if (
      key in localConfig &&
      !(localConfig[key] as string).startsWith("your-")
    ) {
      return localConfig[key];
    }
    if (
      key in globalConfig &&
      !(globalConfig[key] as string).startsWith("your-")
    ) {
      return globalConfig[key];
    }
    console.log(`\nAviso: A configuração '${key}' não está definida.`);
    console.log(`Por favor, defina esta variável utilizando:`);
    console.log(`  lumini config set ${key} <valor> -a\n`);
    return undefined;
  }

  return { ...globalConfig, ...localConfig };
}

/**
 * Define uma configuração em um determinado escopo.
 */
export function setConfig(
  key: string,
  value: any,
  scope: ConfigScope = "local",
) {
  ensureGlobalConfig();

  if (scope === "global" || scope === "all") {
    const globalConfig = readConfigFile(GLOBAL_CONFIG_PATH);
    globalConfig[key] = value;
    writeConfigFile(GLOBAL_CONFIG_PATH, globalConfig);
    console.log(`Configuração '${key}' definida globalmente.`);
  }

  if (scope === "local" || scope === "all") {
    // Se não existir o local, criamos automaticamente para poder salvar.
    if (!existsSync(LOCAL_CONFIG_PATH)) {
      writeConfigFile(LOCAL_CONFIG_PATH, {});
    }
    const localConfig = readConfigFile(LOCAL_CONFIG_PATH);
    localConfig[key] = value;
    writeConfigFile(LOCAL_CONFIG_PATH, localConfig);
    console.log(`Configuração '${key}' definida localmente.`);
  }
}

/**
 * Remove uma configuração de um determinado escopo.
 */
export function deleteConfig(key: string, scope: ConfigScope = "local") {
  ensureGlobalConfig();

  if (scope === "global" || scope === "all") {
    const globalConfig = readConfigFile(GLOBAL_CONFIG_PATH);
    if (key in globalConfig) {
      delete globalConfig[key];
      writeConfigFile(GLOBAL_CONFIG_PATH, globalConfig);
      console.log(`Configuração '${key}' removida globalmente.`);
    }
  }

  if (scope === "local" || scope === "all") {
    if (existsSync(LOCAL_CONFIG_PATH)) {
      const localConfig = readConfigFile(LOCAL_CONFIG_PATH);
      if (key in localConfig) {
        delete localConfig[key];
        writeConfigFile(LOCAL_CONFIG_PATH, localConfig);
        console.log(`Configuração '${key}' removida localmente.`);
      }
    }
  }
}

/**
 * Lista as configurações e de onde estão vindo.
 */
export function listConfigs() {
  ensureGlobalConfig();

  const globalConfig = readConfigFile(GLOBAL_CONFIG_PATH);
  const localConfig = readConfigFile(LOCAL_CONFIG_PATH);

  console.log("--- Configurações Globais ---");
  if (Object.keys(globalConfig).length === 0) {
    console.log("(Nenhuma)");
  } else {
    for (const [k, v] of Object.entries(globalConfig)) {
      console.log(`  ${k}: ${v}`);
    }
  }

  if (existsSync(LOCAL_CONFIG_PATH)) {
    console.log("\n--- Configurações Locais ---");
    if (Object.keys(localConfig).length === 0) {
      console.log("(Nenhuma)");
    } else {
      for (const [k, v] of Object.entries(localConfig)) {
        console.log(`  ${k}: ${v}`);
      }
    }
  }
}
