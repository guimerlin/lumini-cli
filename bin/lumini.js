#!/usr/bin/env node

// Este arquivo NUNCA executa TypeScript diretamente.
// Ele apenas importa o código já transpilado em dist/ (gerado via `tsc`, ver script "build").
import "../dist/presentation/cli.js";
