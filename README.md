````markdown
# Lumini CLI

A CLI to collect, organize, and reuse code components with intelligent dependency resolution via AST analysis (instead of a simple "copy-and-paste" approach).

## Installation and Development Usage

```bash
npm install    # or pnpm install / yarn install
npm run dev:save -- ./src/components/Button.tsx
npm run dev:add -- Button
npm run dev:list
```
````

## Production Build

```bash
npm run build      # tsc: transpiles src/ -> dist/
npm run start -- list
# Or, after "npm link" / global installation:
lumini save ./src/components/Button.tsx
lumini add Button

```

`bin/lumini.js` never executes TypeScript directly — it only imports the already-compiled `dist/presentation/cli.js`. This guarantees fast startup times for anyone installing the package via NPM.

## Commands

### `lumini save <path> [-n name] [-s strategy]`

Analyzes the specified file (or folder), identifies imports via AST, and saves it to the local library (`~/.lumini/library`). If `-s` is not provided, it interactively prompts the user on which strategy to use:

| Strategy | What it does                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `raw`    | Saves only the file as-is. Local imports are not resolved.                                                                                                                  |
| `deps`   | Same as `raw`, but the external dependencies manifest becomes an active contract: `add` will offer to automatically install whatever is missing in the destination project. |
| `bundle` | Injects the code of all locally imported files (recursively) inside the file itself, generating a single self-sufficient file.                                              |
| `folder` | Transforms the file into `Name/index.ext` and copies the locally imported files inside it, remapping import paths via AST.                                                  |

If the target is a **folder**, the internal structure is preserved; imports pointing outside the target folder are either moved into an `_external/` subfolder (using the `folder` strategy) or inlined (using the `bundle` strategy).

### `lumini add <name> [-d folder]`

Copies a saved component to the current project. It checks the closest `package.json` to the destination and, if any external dependency is missing, offers to add it automatically (it does not run the installer — that is left to you).

### `lumini list`

Lists all components saved in the library.

## Architecture

Strictly follows the layered pattern described in the original documentation:

```
src/
├── presentation/     # Commander, prompts (inquirer) — no business logic
├── core/
│   ├── entities/      # ComponentNode, ComponentMetadata
│   ├── interfaces/    # IAstParser, IFileSystemClient, IStorageClient, ISaveStrategy
│   └── services/
│       ├── strategies/           # RawStrategy, DepsStrategy, BundleStrategy, FolderStrategy
│       ├── dependency-graph.service.ts   # traverses the local import graph (used by Bundle/Folder)
│       ├── save-component.service.ts
│       └── add-component.service.ts
└── infrastructure/
    ├── parsers/       # AstParserClient (Babel: @babel/parser + traverse + generator)
    └── clients/       # FileSystemClient (fs-extra), StorageClient (~/.lumini/library)

```

`core` never imports anything directly from `infrastructure` — it always goes through interfaces (`IAstParser`, `IFileSystemClient`, `IStorageClient`). Switching local storage to S3, for example, simply means creating a new `IStorageClient` and swapping its instantiation at the composition root (`presentation/commands/*.command.ts`).

## Known Limitations (Honest)

- **Bundle** is not a full bundler: it does not perform tree-shaking, nor does it resolve naming collisions between different modules exporting symbols with the same identifier. It works well for "component + a few hooks/utils"; for large trees, prefer the `folder` strategy.
- The "entry file" detection when saving an entire **folder** uses a heuristic (the only file that no other internal file imports). For structures without an obvious entry point, it is worth double-checking the generated metadata's `entryFile`.
- Module resolution covers `.ts/.tsx/.js/.jsx/.mjs/.cjs` and `index` variations; path mapping configured via `tsconfig.json` (`baseUrl`/`paths`) is not yet supported.

```

```
