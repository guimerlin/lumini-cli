import path from 'path';
import { AddComponentService } from '../../core/services/AddComponentService.js';
import { FileSystemClient } from '../../infrastructure/clients/FileSystemClient.js';
import { promptAddDestination } from '../prompts/index.js';
import fs from 'fs/promises';
export async function addCommandAction(nome) {
    console.log(`[Lumini] Buscando o componente: ${nome}`);
    const storageClient = new FileSystemClient();
    const addService = new AddComponentService(storageClient);
    try {
        let targetPath = '';
        const configPath = path.join(process.cwd(), 'lumini.json');
        if (await storageClient.exists(configPath)) {
            const configContent = await storageClient.readFile(configPath);
            const config = JSON.parse(configContent);
            targetPath = config.dest || './src/components';
        }
        else {
            targetPath = await promptAddDestination();
        }
        // We add the component folder itself, or just the contents?
        // Let's add it as a subfolder in the targetPath for neatness.
        const finalDest = path.join(process.cwd(), targetPath, nome);
        console.log(`Adicionando '${nome}' em ${finalDest}...`);
        await addService.execute({
            componentName: nome,
            targetPath: finalDest
        });
        // Check for dependencies and notify
        const libraryPath = storageClient.getGlobalLibraryPath();
        const metadataPath = path.join(libraryPath, nome, 'metadata.json');
        if (await storageClient.exists(metadataPath)) {
            const metadataContent = await storageClient.readFile(metadataPath);
            const metadata = JSON.parse(metadataContent);
            const deps = Object.keys(metadata.dependencies);
            if (deps.length > 0) {
                console.log(`\n⚠️  Este componente possui dependências externas. Verifique se o seu package.json inclui:`);
                deps.forEach(dep => console.log(`  - ${dep}`));
            }
        }
        console.log(`\nComponente '${nome}' adicionado com sucesso!`);
    }
    catch (error) {
        console.error(`Erro ao adicionar componente: ${error.message}`);
    }
}
