import { deleteConfig } from "../../core/config/index.js";

export const command = {
  name: "delete <key>",
  description: "Remove uma configuração",
  flags: [
    { name: "-g, --global", description: "Remove globalmente" },
    { name: "-a, --all", description: "Remove globalmente e localmente" },
  ],
  action: (key: string, options: any) => {
    let scope: "local" | "global" | "all" = "local";
    if (options.all) scope = "all";
    else if (options.global) scope = "global";

    deleteConfig(key, scope);
  }
};
