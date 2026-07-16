import fs from 'fs/promises';
import path from 'path';
import os from 'os';
export class FileSystemClient {
    async readFile(filePath) {
        return await fs.readFile(filePath, 'utf-8');
    }
    async writeFile(filePath, content) {
        await fs.writeFile(filePath, content, 'utf-8');
    }
    async createDir(dirPath) {
        await fs.mkdir(dirPath, { recursive: true });
    }
    async copyFile(src, dest) {
        await fs.copyFile(src, dest);
    }
    async copyDir(src, dest) {
        await fs.cp(src, dest, { recursive: true });
    }
    async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    getGlobalLibraryPath() {
        const homeDir = os.homedir();
        return path.join(homeDir, '.lumini');
    }
    async readDir(dirPath) {
        return await fs.readdir(dirPath);
    }
}
