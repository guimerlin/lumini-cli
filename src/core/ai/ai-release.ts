import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const prompt = `
Você é um Release Manager responsável por analisar o histórico de commits de um repositório e preparar a próxima versão do software.

# TAREFA:
1. Analise a lista de commits realizados desde a última release.
2. Determine o incremento semântico correto (SemVer) com base na natureza dos commits:
   - MAJOR: Se houver "BREAKING CHANGE" ou mudanças incompatíveis.
   - MINOR: Se houver novas funcionalidades ("feat").
   - PATCH: Se houver apenas correções ("fix"), refatorações ou tarefas de manutenção.
3. Gere um Release Notes (Changelog) organizado e profissional em formato Markdown.

# DADOS DO REPOSITÓRIO:
Versão Atual: {currentVersion}

Histórico de Commits:
{commitHistory}
`;
