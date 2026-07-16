# Quadro de Tarefas Lumini CLI

## Ideias

### Comando Delete para Componentes Importados
- due: 2026-07-25
- tags: [core, utilitarios]
- priority: medium
- workload: Normal
- defaultExpanded: false
- steps:
  - [ ] Criar comando 'delete' no commander (delete.command.ts)
  - [ ] Ler arquivo de configuração local '.lumini' para buscar o componente importado
  - [ ] Remover os arquivos associados ao componente do sistema de arquivos do projeto
  - [ ] Atualizar o arquivo '.lumini' removendo o registro do componente importado

```md
Permite a remoção limpa de um componente previamente importado no projeto atual usando o comando `lumini delete <nome>`. O comando consulta as anotações do arquivo `.lumini` para identificar os arquivos correspondentes e excluí-los com segurança do disco.
```

## Fila

### Tradução para Inglês e Estilização Visual
- due: 2026-07-20
- tags: [apresentacao, internacionalizacao]
- priority: high
- workload: Normal
- defaultExpanded: true
- steps:
  - [ ] Traduzir todas as mensagens do CLI (cli.ts, save.command.ts, add.command.ts, list.command.ts) de português para inglês.
  - [ ] Estilizar os prompts com chalk e emojis representativos (ex: 📄 para arquivo, 📁 para pasta).
  - [ ] Traduzir mensagens de erro e logs informativos.

### Organização por Tags
- due: 2026-07-20
- tags: [core, infraestrutura]
- priority: high
- workload: Hard
- defaultExpanded: true
- steps:
  - [ ] Atualizar entidade `ComponentMetadata` com a propriedade `tag`.
  - [ ] Atualizar `StorageClient` para lidar com estrutura baseada em tags (`library/tag/componente` e `library/_general/componente`).
  - [ ] Habilitar resolução automática ao carregar componentes usando `@tag/nome` ou buscando por padrão no `_general`.
  - [ ] Ajustar comando list para agrupar e mostrar as tags nos componentes salvos.
  - [ ] Adicionar prompt interativo para selecionar tags existentes ou criar novas ao salvar componentes.

### Gerenciador de Componentes Interativo
- due: 2026-07-21
- tags: [apresentacao, interativo]
- priority: high
- workload: Hard
- defaultExpanded: true
- steps:
  - [ ] Modificar o comando raiz `lumini` para abrir o dashboard interativo caso nenhum subcomando seja fornecido.
  - [ ] Desenhar o dashboard com interface estilizada listando vaults e opções principais.
  - [ ] Desenvolver fluxo de seleção de componentes múltiplos usando checkbox do inquirer.
  - [ ] Implementar a ação de exclusão física dos componentes selecionados da library.
  - [ ] Implementar a ação de injeção dos componentes selecionados no projeto com prompts de destino/dependências.

### Memorização de Importações (.lumini)
- due: 2026-07-21
- tags: [core, configuracao]
- priority: high
- workload: Hard
- defaultExpanded: true
- steps:
  - [ ] Definir o schema e ler o arquivo `.lumini` na raiz do projeto.
  - [ ] Implementar a verificação de duplicidade antes de importar um componente (avisar e perguntar se deseja sobrescrever).
  - [ ] Salvar as configurações de pastas de importação e salvar por padrão no `.lumini` caso o usuário defina.
  - [ ] Anotar os componentes importados com seus caminhos no `.lumini` após cada injeção bem-sucedida.

### Sistema de Vaults para Arquivos .env
- due: 2026-07-22
- tags: [core, seguranca]
- priority: high
- workload: Extreme
- defaultExpanded: true
- steps:
  - [ ] Detectar arquivos `.env` ou que iniciem com `.env` ao salvar um componente/pasta.
  - [ ] Perguntar ao usuário se deseja salvar o arquivo `.env` como um Vault de variáveis de ambiente.
  - [ ] Salvar os vaults em diretórios separados `~/.lumini/vault/[vault_name]/.env`.
  - [ ] Mostrar os Vaults no dashboard com as variáveis mascaradas em formato escondido (`******`).
  - [ ] Implementar a importação seletiva de variáveis do Vault (seleção por checkbox) ou completa para o `.env` local do projeto.

### Suporte a Outros Arquivos e Modo Estrutura-Apenas
- due: 2026-07-22
- tags: [core, ast]
- priority: medium
- workload: Normal
- defaultExpanded: true
- steps:
  - [ ] Ajustar `AstParserClient` para ignorar análise AST de Babel em arquivos que não sejam JS/TS (ex: CSS, JSON, HTML).
  - [ ] Adicionar flag `--structure` para salvar somente a estrutura de diretórios e ignorar arquivos.
  - [ ] Implementar lógica na estratégia de salvar e adicionar para lidar com estrutura pura.

### Respeitar .gitignore
- due: 2026-07-22
- tags: [core, utilidades]
- priority: medium
- workload: Easy
- defaultExpanded: true
- steps:
  - [ ] Desenvolver utilitário de correspondência simples de regras de `.gitignore` (ex: ignorar `node_modules`, `dist`).
  - [ ] Ler o arquivo `.gitignore` do projeto, caso exista, antes de ler arquivos da pasta.
  - [ ] Filtrar caminhos ignorados ao listar arquivos recursivamente.

## Fazendo

## Feito
