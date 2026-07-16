# Lumini CLI

CLI para coletar, organizar e reutilizar componentes de código, com resolução
inteligente de dependências via análise de AST (em vez de um simples "copiar e colar").

## Instalação e uso em desenvolvimento

```bash
npm install    # ou pnpm install / yarn install
npm run dev:save -- ./src/components/Button.tsx
npm run dev:add -- Button
npm run dev:list
```

## Build de produção

```bash
npm run build      # tsc: transpila src/ -> dist/
npm run start -- list
# ou, depois de "npm link" / instalação global:
lumini save ./src/components/Button.tsx
lumini add Button
```

`bin/lumini.js` nunca executa TypeScript diretamente — ele só importa
`dist/presentation/cli.js`, já compilado. Isso garante tempo de inicialização
rápido para quem instalar o pacote via NPM.

## Comandos

### `lumini save <caminho> [-n nome] [-s estrategia]`

Analisa o arquivo (ou pasta) indicado, identifica as importações via AST e
salva na biblioteca local (`~/.lumini/library`). Se `-s` não for informado,
pergunta interativamente qual estratégia usar:

| Estratégia | O que faz |
|---|---|
| `raw` | Salva só o arquivo, como está. Imports locais não são resolvidos. |
| `deps` | Igual ao `raw`, mas o manifesto de deps externas vira um contrato ativo: o `add` oferece instalar automaticamente o que faltar no projeto de destino. |
| `bundle` | Injeta o código de todos os arquivos locais importados (recursivamente) dentro do próprio arquivo, gerando um único arquivo autossuficiente. |
| `folder` | Transforma o arquivo em `Nome/index.ext` e copia para dentro os arquivos locais importados, remapeando os caminhos de import via AST. |

Se o alvo for uma **pasta**, a estrutura interna é preservada; imports que
apontem para fora da pasta são trazidos para uma subpasta `_external/`
(estratégia `folder`) ou inline (estratégia `bundle`).

### `lumini add <nome> [-d pasta]`

Copia um componente salvo para o projeto atual. Verifica o `package.json`
mais próximo do destino e, se faltar alguma dependência externa, oferece
adicioná-la automaticamente (não roda o instalador — isso fica por sua conta).

### `lumini list`

Lista os componentes salvos na biblioteca.

## Arquitetura

Segue rigorosamente o padrão em camadas descrito na documentação original:

```
src/
├── presentation/     # Commander, prompts (inquirer) — sem lógica de negócio
├── core/
│   ├── entities/      # ComponentNode, ComponentMetadata
│   ├── interfaces/    # IAstParser, IFileSystemClient, IStorageClient, ISaveStrategy
│   └── services/
│       ├── strategies/           # RawStrategy, DepsStrategy, BundleStrategy, FolderStrategy
│       ├── dependency-graph.service.ts   # percorre o grafo de imports locais (usado por Bundle/Folder)
│       ├── save-component.service.ts
│       └── add-component.service.ts
└── infrastructure/
    ├── parsers/       # AstParserClient (Babel: @babel/parser + traverse + generator)
    └── clients/       # FileSystemClient (fs-extra), StorageClient (~/.lumini/library)
```

`core` nunca importa nada de `infrastructure` diretamente — sempre através das
interfaces (`IAstParser`, `IFileSystemClient`, `IStorageClient`). Trocar o
armazenamento local por S3, por exemplo, significa criar um novo
`IStorageClient` e trocar a instanciação na composition root (`presentation/commands/*.command.ts`).

## Limitações conhecidas (honestas)

- **Bundle** não é um bundler completo: não faz tree-shaking nem resolve
  colisões de nomes entre módulos diferentes que exportem símbolos com o
  mesmo identificador. Funciona bem para "componente + alguns hooks/utils";
  para árvores grandes, prefira `folder`.
- A detecção de "arquivo de entrada" ao salvar uma **pasta** inteira usa uma
  heurística (o único arquivo que nenhum outro arquivo interno importa). Em
  estruturas sem um ponto de entrada óbvio, vale conferir o `entryFile` do
  metadata gerado.
- Resolução de módulos cobre `.ts/.tsx/.js/.jsx/.mjs/.cjs` e variações de
  `index`; paths mapeados via `tsconfig.json` (`baseUrl`/`paths`) ainda não
  são resolvidos.
