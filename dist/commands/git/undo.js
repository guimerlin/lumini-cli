import { restoreUndoSnapshot } from "../../core/git/git.js";
export const command = {
    name: "undo",
    description: "Reverte os commits gerados pelo Lumini para o estado anterior",
    async action() {
        console.log("⏪ Lumini revertendo para o último ponto de restauração...");
        try {
            restoreUndoSnapshot();
        }
        catch (err) {
            console.error(`❌ ${err.message}`);
            process.exit(1);
        }
    },
};
