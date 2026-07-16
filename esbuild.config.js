// esbuild.config.js
import esbuild from "esbuild";

esbuild
  .build({
    entryPoints: ["dist/presentation/cli.js"],
    outfile: "bin/cli.js",
    bundle: true,
    minify: true,
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: false,
  })
  .catch(() => process.exit(1));
