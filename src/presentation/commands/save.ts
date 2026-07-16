import path from 'path';
import { SaveComponentService } from '../../core/services/SaveComponentService.js';
import { FileSystemClient } from '../../infrastructure/clients/FileSystemClient.js';
import { AstParserClient } from '../../infrastructure/parsers/AstParserClient.js';
import { promptStrategy, promptComponentName } from '../prompts/index.js';

export async function saveCommandAction(caminho: string) {
  console.log(`[Lumini] Analisando o caminho: ${caminho}`);

  const storageClient = new FileSystemClient();
  const astParser = new AstParserClient();
  const saveService = new SaveComponentService(storageClient, astParser);

  try {
    const isExists = await storageClient.exists(caminho);
    if (!isExists) {
      console.error(`Erro: Arquivo ou pasta não encontrado em ${caminho}`);
      process.exit(1);
    }

    const defaultName = path.parse(caminho).name;
    let componentName = await promptComponentName(defaultName);

    // Check for conflict
    const libraryPath = storageClient.getGlobalLibraryPath();
    while (await storageClient.exists(path.join(libraryPath, componentName))) {
       console.log(`Um componente com o nome '${componentName}' já existe.`);
       componentName = await promptComponentName(`${componentName}-1`);
    }

    const strategy = await promptStrategy();

    console.log(`Salvando componente '${componentName}' usando a estratégia '${strategy}'...`);

    await saveService.execute({
      componentPath: caminho,
      componentName,
      strategy
    });

    console.log(`Componente '${componentName}' salvo com sucesso!`);
  } catch (error: any) {
    console.error(`Erro ao salvar componente: ${error.message}`);
  }
}
