import { getConfig } from "../../core/config/index.js";

export const command = {
  name: "get <key>",
  description: "Lê uma configuração",
  action: (key: string) => {
    const value = getConfig(key);
    if (value !== undefined) {
      console.log(value);
    }
  }
};
