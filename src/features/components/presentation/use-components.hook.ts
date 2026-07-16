import { useState, useCallback, useMemo } from 'react';
import { StorageClient } from '../../../shared/infrastructure/clients/storage.client.js';
import { FileSystemClient } from '../../../shared/infrastructure/clients/file-system.client.js';
import { AstParserClient } from '../../../shared/infrastructure/parsers/ast-parser.client.js';
import { AddComponentService } from '../core/add-component.service.js';
import { SaveComponentService } from '../core/save-component.service.js';
import { RawStrategy } from '../core/strategies/raw.strategy.js';
import { DepsStrategy } from '../core/strategies/deps.strategy.js';
import { BundleStrategy } from '../core/strategies/bundle.strategy.js';
import { FolderStrategy } from '../core/strategies/folder.strategy.js';
import type { ComponentMetadata, SaveStrategy } from '../../../shared/core/entities/metadata.entity.js';

export function useComponents() {
  const [components, setComponents] = useState<ComponentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageClient = useMemo(() => new StorageClient(), []);
  const fsClient = useMemo(() => new FileSystemClient(), []);
  const astParser = useMemo(() => new AstParserClient(), []);

  const addService = useMemo(() => new AddComponentService(storageClient, fsClient), [storageClient, fsClient]);
  const saveService = useMemo(() => new SaveComponentService(
    {
      raw: new RawStrategy(astParser, fsClient),
      deps: new DepsStrategy(astParser, fsClient),
      bundle: new BundleStrategy(astParser, fsClient),
      folder: new FolderStrategy(astParser, fsClient),
    },
    storageClient,
    fsClient
  ), [astParser, storageClient, fsClient]);

  const loadComponents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await storageClient.list();
      setComponents(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [storageClient]);

  const addComponent = useCallback(async (name: string, dest: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await addService.execute({
        name,
        destinationDirAbsolutePath: dest,
      });
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [addService]);

  const saveComponent = useCallback(async (options: {
    name: string;
    targetAbsolutePath: string;
    strategy: SaveStrategy;
    tag?: string;
    structureOnly?: boolean;
    excludeFiles?: string[];
    associatedVault?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await saveService.execute(options);
      await loadComponents();
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [saveService, loadComponents]);

  const deleteComponent = useCallback(async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await storageClient.remove(name);
      await loadComponents();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [storageClient, loadComponents]);

  return {
    components,
    isLoading,
    error,
    loadComponents,
    addComponent,
    saveComponent,
    deleteComponent,
  };
}
