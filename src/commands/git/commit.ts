import {
  getGitStatus,
  getGitDiff,
  stageFiles,
  createCommit,
  saveUndoSnapshot,
} from "../../core/git/git.js";
import { analyzeAndGroupCommits } from "../../core/ai/ai-commit.js";

export const command = {
  name: "commit",
  description: "Agrupa alterações do repo e realiza commits inteligentes com IA",
  flags: [
    {
      name: "-d, --dry-run",
      description: "Simula a execução sem aplicar os commits",
    },
  ],

  async action(options: { dryRun?: boolean }) {
    console.log("🔍 Lumini analisando o repositório...");

    const status = getGitStatus();

    if (status.length === 0) {
      console.log("✅ Nenhuma alteração encontrada no repositório.");
      return;
    }

    const diff = getGitDiff();

    if (!diff.hasChanges) {
      console.log("✅ Nenhuma alteração staged ou unstaged encontrada.");
      return;
    }

    if (options.dryRun) {
      console.log("🔍 Modo Dry-Run ativado. Nenhum commit será feito.\n");
    } else {
      // Salva snapshot antes de qualquer ação para permitir undo
      saveUndoSnapshot();
    }

    // Chama a IA para agrupar e propor commits
    const result = await analyzeAndGroupCommits(status, diff);

    // analyzeAndGroupCommits retorna { groups } mas o schema define "commits"
    // Lida com ambos os formatos por segurança
    const commits = (result as any).commits ?? (result as any).groups ?? [];

    if (commits.length === 0) {
      console.log("🤷 A IA não conseguiu determinar agrupamentos de commit.");
      return;
    }

    console.log(`\n📦 ${commits.length} commit(s) proposto(s):\n`);

    for (const commit of commits) {
      console.log(`  → ${commit.message}`);
      console.log(`    Arquivos: ${commit.files.join(", ")}\n`);
    }

    if (options.dryRun) {
      console.log("🔍 Dry-Run finalizado. Nenhum commit foi criado.");
      return;
    }

    // Realiza os commits em sequência
    for (const commit of commits) {
      stageFiles(commit.files);
      const output = createCommit(commit.message);
      console.log(`✅ Commit criado: ${commit.message}`);
      console.log(`   ${output.split("\n")[0]}`);
    }

    console.log("\n🎉 Todos os commits foram aplicados com sucesso!");
    console.log('💡 Dica: use "lumini git undo" para reverter se necessário.');
  },
};
