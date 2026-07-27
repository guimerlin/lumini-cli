import { setConfig } from "../../core/config/index.js";

export const command = {
  name: "set <key> <value>",
  description: "Define uma configuração",
  flags: [
    { name: "-g, --global", description: "Define globalmente" },
    { name: "-a, --all", description: "Define globalmente e localmente" },
  ],
  action: (key: string, value: string, options: any) => {
    let scope: "local" | "global" | "all" = "local";
    if (options.all) scope = "all";
    else if (options.global) scope = "global";

    setConfig(key, value, scope);
  }
};
