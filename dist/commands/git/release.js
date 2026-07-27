import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isGitRepository, getCurrentVersion, getLastTag, getCommitsSinceTag, getLastCommitDiff, createTag, } from "../../core/git/git.js";
import { generateRelease } from "../../core/ai/ai-release.js";
export const command = {
    name: "release",
    description: "Analisa o último commit com IA e gera changelog + tag semântica",
    flags: [
        {
            name: "-d, --dry-run",
            description: "Simula a release sem criar a tag nem gravar arquivos",
        },
        {
            name: "--no-tag",
            description: "Gera o changelog mas não cria a tag Git",
        },
        {
            name: "-o, --output <file>",
            description: "Caminho do arquivo de saída do changelog (padrão: CHANGELOG.md)",
        },
    ],
    async action(options) {
        if (!isGitRepository()) {
            console.error("❌ O diretório atual não é um repositório Git.");
            process.exit(1);
        }
        // ── Coleta de dados ──────────────────────────────────────────────────────
        const currentVersion = getCurrentVersion();
        const lastTag = getLastTag();
        const commitMessages = getCommitsSinceTag(lastTag);
        const commitDiff = getLastCommitDiff();
        console.log(`📋 Versão atual: ${currentVersion}`);
        console.log(`🏷️  Última tag  : ${lastTag ?? "(nenhuma)"}`);
        console.log(`📝 Commits desde a última tag: ${commitMessages.length}\n`);
        if (commitMessages.length === 0 && !commitDiff) {
            console.log("✅ Nenhuma mudança detectada desde a última release.");
            return;
        }
        // ── Chamada à IA ─────────────────────────────────────────────────────────
        const release = await generateRelease(currentVersion, commitDiff, commitMessages);
        // ── Exibe o resultado ────────────────────────────────────────────────────
        console.log("\n" + "═".repeat(60));
        console.log(`🚀 ${release.title}`);
        console.log("═".repeat(60));
        console.log(`\n📌 Tipo de bump : ${release.bumpType.toUpperCase()}`);
        console.log(`📦 Nova versão  : v${release.nextVersion}\n`);
        console.log("💬 Resumo:");
        console.log(`   ${release.summary}\n`);
        if (release.highlights.length > 0) {
            console.log("✨ Destaques:");
            release.highlights.forEach((h) => console.log(`   • ${h}`));
            console.log();
        }
        if (release.breakingChanges.length > 0) {
            console.log("⚠️  Breaking Changes:");
            release.breakingChanges.forEach((b) => console.log(`   ‼ ${b}`));
            console.log();
        }
        console.log("📄 Changelog:");
        console.log("─".repeat(60));
        console.log(release.changelog);
        console.log("─".repeat(60) + "\n");
        if (options.dryRun) {
            console.log("🔍 Dry-Run ativado. Nenhuma tag ou arquivo foi criado.");
            return;
        }
        // ── Grava o CHANGELOG.md ─────────────────────────────────────────────────
        const outputFile = options.output ?? "CHANGELOG.md";
        const outputPath = join(process.cwd(), outputFile);
        let existingContent = "";
        if (existsSync(outputPath)) {
            existingContent = readFileSync(outputPath, "utf-8");
        }
        // Insere o novo bloco no topo do arquivo
        const newContent = release.changelog + "\n\n" + existingContent;
        writeFileSync(outputPath, newContent, "utf-8");
        console.log(`✅ Changelog gravado em: ${outputFile}`);
        // ── Cria a tag Git ───────────────────────────────────────────────────────
        const shouldTag = options.tag !== false; // "--no-tag" seta tag=false
        if (shouldTag) {
            try {
                createTag(release.nextVersion, release.title);
                console.log(`🏷️  Tag criada: v${release.nextVersion}`);
            }
            catch (err) {
                console.error(`⚠️  Não foi possível criar a tag: ${err.message}`);
            }
        }
        console.log(`\n🎉 Release v${release.nextVersion} concluída com sucesso!`);
        console.log('💡 Dica: use "git push --follow-tags" para publicar a tag remota.');
    },
};
