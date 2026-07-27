#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tsRunner = resolve(__dirname, "../node_modules/.bin/tsx");
const tsEntryPoint = resolve(__dirname, "../src/index.ts");
const jsEntryPoint = resolve(__dirname, "../dist/index.js");

// Se estiver em desenvolvimento e o tsx existir, roda direto em TypeScript
if (existsSync(tsEntryPoint) && existsSync(tsRunner)) {
  const result = spawnSync(tsRunner, [tsEntryPoint, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 0);
} else if (existsSync(jsEntryPoint)) {
  // Caso contrário (produção/após build), roda o JavaScript compilado
  import(jsEntryPoint);
} else {
  console.error(
    '❌ Não foi possível encontrar o ponto de entrada do Lumini CLI. Execute "pnpm build" primeiro.',
  );
  process.exit(1);
}
