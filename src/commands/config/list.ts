import { listConfigs } from "../../core/config/index.js";

export const command = {
  name: "list",
  description: "Lista as configurações",
  action: () => {
    listConfigs();
  }
};
