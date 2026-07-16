import prompts from 'prompts';
export async function promptStrategy() {
    const { strategy } = await prompts({
        type: 'select',
        name: 'strategy',
        message: 'Como você deseja tratar as dependências e imports locais?',
        choices: [
            { title: 'Apenas o arquivo principal (ignorar imports)', value: 'raw' },
            { title: 'Arquivo principal + dependências do package.json', value: 'deps' },
            { title: 'Unir tudo em um único arquivo (Bundle)', value: 'bundle' },
            { title: 'Agrupar em uma pasta com sub-arquivos remapeados', value: 'folder' },
        ],
    });
    return strategy;
}
export async function promptComponentName(defaultName) {
    const { name } = await prompts({
        type: 'text',
        name: 'name',
        message: 'Qual será o nome do componente na biblioteca?',
        initial: defaultName,
    });
    return name;
}
export async function promptAddDestination() {
    const { dest } = await prompts({
        type: 'text',
        name: 'dest',
        message: 'Onde você deseja salvar este componente? (caminho relativo)',
        initial: './src/components',
    });
    return dest;
}
