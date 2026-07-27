type ConfigScope = "local" | "global" | "all";
/**
 * Inicializa a configuração local (cria .lumini se não existir).
 */
export declare function initConfigs(): void;
/**
 * Pega um valor de configuração.
 * Se houver no local, usa o local. Se não, busca no global.
 * @param key Chave da configuração. Se não passada, retorna o objeto com a mescla de global + local.
 */
export declare function getConfig(key?: string): any;
/**
 * Define uma configuração em um determinado escopo.
 */
export declare function setConfig(key: string, value: any, scope?: ConfigScope): void;
/**
 * Remove uma configuração de um determinado escopo.
 */
export declare function deleteConfig(key: string, scope?: ConfigScope): void;
/**
 * Lista as configurações e de onde estão vindo.
 */
export declare function listConfigs(): void;
export {};
