import { useState, useCallback, useMemo } from 'react';
import { FileSystemClient } from '../../../shared/infrastructure/clients/file-system.client.js';
import { ConfigService, type LuminiConfig } from '../core/config.service.js';

export function useConfig() {
  const [config, setConfig] = useState<LuminiConfig>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fsClient = useMemo(() => new FileSystemClient(), []);
  const configService = useMemo(() => new ConfigService(fsClient), [fsClient]);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const exists = await configService.exists();
      if (exists) {
        const current = await configService.read();
        setConfig(current);
      } else {
        setConfig({});
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [configService]);

  const saveConfig = useCallback(async (newConfig: LuminiConfig) => {
    setIsLoading(true);
    setError(null);
    try {
      await configService.write(newConfig);
      setConfig(newConfig);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [configService]);

  const registerImport = useCallback(async (name: string, tag: string | undefined, files: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      await configService.registerImport(name, tag, files);
      await loadConfig();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [configService, loadConfig]);

  const registerVaultImport = useCallback(async (vaultName: string, keys: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      await configService.registerVaultImport(vaultName, keys);
      await loadConfig();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [configService, loadConfig]);

  const existsConfig = useCallback(async () => {
    return configService.exists();
  }, [configService]);

  return {
    config,
    isLoading,
    error,
    loadConfig,
    saveConfig,
    registerImport,
    registerVaultImport,
    existsConfig,
    configService,
  };
}
