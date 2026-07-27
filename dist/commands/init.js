import { initConfigs } from "../core/config/index.js";
export const command = {
    name: "init",
    description: "Inicializa as configurações locais do lumini na pasta atual",
    action: () => {
        initConfigs();
    },
};
