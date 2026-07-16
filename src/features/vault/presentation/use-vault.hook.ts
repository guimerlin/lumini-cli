import { useState, useCallback, useMemo } from 'react';
import { FileSystemClient } from '../../../shared/infrastructure/clients/file-system.client.js';
import { VaultService, type VaultInfo } from '../core/vault.service.js';

export function useVault() {
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fsClient = useMemo(() => new FileSystemClient(), []);
  const vaultService = useMemo(() => new VaultService(fsClient), [fsClient]);

  const loadVaults = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await vaultService.listVaults();
      setVaults(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [vaultService]);

  const saveVault = useCallback(async (name: string, variables: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    try {
      await vaultService.saveVault(name, variables);
      await loadVaults();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vaultService, loadVaults]);

  const deleteVault = useCallback(async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await vaultService.removeVault(name);
      await loadVaults();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vaultService, loadVaults]);

  const mergeVaultVariables = useCallback(async (destPath: string, variables: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    try {
      await vaultService.mergeVariables(destPath, variables);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [vaultService]);

  const parseEnvContent = useCallback((content: string) => {
    return vaultService.parseEnv(content);
  }, [vaultService]);

  return {
    vaults,
    isLoading,
    error,
    loadVaults,
    saveVault,
    deleteVault,
    mergeVaultVariables,
    parseEnvContent,
    vaultService,
  };
}
