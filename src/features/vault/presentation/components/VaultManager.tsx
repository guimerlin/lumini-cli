import { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Select, MultiSelect, TextInput, Spinner, StatusMessage } from "@inkjs/ui";
import type { useVault } from "../use-vault.hook.js";
import type { useConfig } from "../../../config/presentation/use-config.hook.js";
import path from "node:path";

interface VaultManagerProps {
  vaultHook: ReturnType<typeof useVault>;
  configHook: ReturnType<typeof useConfig>;
  onBack: () => void;
}

type Step = "LIST" | "ACTIONS" | "IMPORT_ALL_PATH" | "IMPORT_SOME_SELECT" | "IMPORT_SOME_PATH" | "CONFIRM_DELETE";

export function VaultManager({ vaultHook, configHook, onBack }: VaultManagerProps) {
  const { vaults, isLoading, error, loadVaults, deleteVault, mergeVaultVariables } = vaultHook;
  const { registerVaultImport } = configHook;

  const [step, setStep] = useState<Step>("LIST");
  const [selectedVaultName, setSelectedVaultName] = useState<string | null>(null);
  const [envPath, setEnvPath] = useState(".env");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  const selectedVault = vaults.find((v) => v.name === selectedVaultName);

  const handleSelectVault = (vaultName: string) => {
    if (vaultName === "back") {
      onBack();
      return;
    }
    setSelectedVaultName(vaultName);
    setStep("ACTIONS");
    setStatus(null);
  };

  const handleAction = async (action: string) => {
    if (action === "back") {
      setStep("LIST");
      setSelectedVaultName(null);
      return;
    }

    if (action === "delete") {
      setStep("CONFIRM_DELETE");
      return;
    }

    if (action === "import_all") {
      setStep("IMPORT_ALL_PATH");
      return;
    }

    if (action === "import_some") {
      setStep("IMPORT_SOME_SELECT");
      return;
    }
  };

  const handleImportAllSubmit = async (pathValue: string) => {
    if (!selectedVault) return;
    try {
      const targetEnvFile = path.resolve(process.cwd(), pathValue);
      await mergeVaultVariables(targetEnvFile, selectedVault.variables);
      await registerVaultImport(selectedVault.name, Object.keys(selectedVault.variables));
      
      setStatus({
        type: "success",
        text: `Successfully imported all variables to ${path.relative(process.cwd(), targetEnvFile)}!`,
      });
      setStep("LIST");
      setSelectedVaultName(null);
    } catch (err) {
      setStatus({
        type: "error",
        text: `Failed to import variables: ${(err as Error).message}`,
      });
      setStep("ACTIONS");
    }
  };

  const handleImportSomeSubmit = async (pathValue: string) => {
    if (!selectedVault || selectedKeys.length === 0) return;
    try {
      const targetEnvFile = path.resolve(process.cwd(), pathValue);
      const varsToImport: Record<string, string> = {};
      for (const key of selectedKeys) {
        varsToImport[key] = selectedVault.variables[key] as string;
      }
      await mergeVaultVariables(targetEnvFile, varsToImport);
      await registerVaultImport(selectedVault.name, selectedKeys);

      setStatus({
        type: "success",
        text: `Successfully imported ${selectedKeys.length} variables to ${path.relative(process.cwd(), targetEnvFile)}!`,
      });
      setStep("LIST");
      setSelectedVaultName(null);
    } catch (err) {
      setStatus({
        type: "error",
        text: `Failed to import variables: ${(err as Error).message}`,
      });
      setStep("ACTIONS");
    }
  };

  const handleConfirmDelete = async (confirm: string) => {
    if (confirm === "yes" && selectedVaultName) {
      try {
        await deleteVault(selectedVaultName);
        setStatus({
          type: "success",
          text: `Vault "${selectedVaultName}" has been deleted.`,
        });
      } catch (err) {
        setStatus({
          type: "error",
          text: `Failed to delete vault: ${(err as Error).message}`,
        });
      }
    }
    setStep("LIST");
    setSelectedVaultName(null);
  };

  if (isLoading) {
    return (
      <Box padding={1}>
        <Spinner label="Processing vault operation..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      {status && (
        <StatusMessage variant={status.type}>{status.text}</StatusMessage>
      )}

      {error && (
        <StatusMessage variant="error">Error: {error}</StatusMessage>
      )}

      {step === "LIST" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="cyan">🔑 Manage Environment Vaults</Text>
          {vaults.length === 0 ? (
            <Box flexDirection="column" gap={1}>
              <Text color="gray">No vaults stored yet. Save a component containing a .env file first.</Text>
              <Select
                options={[{ label: "◀ Back to Dashboard", value: "back" }]}
                onChange={handleSelectVault}
              />
            </Box>
          ) : (
            <Box flexDirection="column" gap={1}>
              <Text color="white">Select a Vault to manage:</Text>
              <Select
                options={[
                  ...vaults.map((v) => ({
                    label: `Vault: ${v.name} (${Object.keys(v.variables).length} variables)`,
                    value: v.name,
                  })),
                  { label: "◀ Back to Dashboard", value: "back" },
                ]}
                onChange={handleSelectVault}
              />
            </Box>
          )}
        </Box>
      )}

      {step === "ACTIONS" && selectedVault && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="cyan">🔑 Vault: {selectedVault.name}</Text>
          <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginBottom={1}>
            <Text bold color="yellow">Variables stored:</Text>
            {Object.keys(selectedVault.variables).map((key) => (
              <Text key={key} color="gray">  - {key}=******</Text>
            ))}
          </Box>
          <Select
            options={[
              { label: "📥 Import ALL variables to project .env", value: "import_all" },
              { label: "🎛 Select specific variables to import", value: "import_some" },
              { label: "🚨 Delete Vault", value: "delete" },
              { label: "◀ Back to Vaults List", value: "back" },
            ]}
            onChange={handleAction}
          />
        </Box>
      )}

      {step === "IMPORT_ALL_PATH" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="cyan">📥 Import All to Project</Text>
          <Text color="white">Enter destination file path (default: .env):</Text>
          <TextInput
            defaultValue={envPath}
            onChange={setEnvPath}
            onSubmit={handleImportAllSubmit}
          />
        </Box>
      )}

      {step === "IMPORT_SOME_SELECT" && selectedVault && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="cyan">🎛 Select Variables to Import</Text>
          <Text color="gray">Use Space to toggle selections, Enter to confirm:</Text>
          <MultiSelect
            options={Object.keys(selectedVault.variables).map((key) => ({
              label: key,
              value: key,
            }))}
            onChange={(keys) => {
              setSelectedKeys(keys);
              setStep("IMPORT_SOME_PATH");
            }}
          />
        </Box>
      )}

      {step === "IMPORT_SOME_PATH" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="cyan">📥 Import Selected to Project</Text>
          <Text color="white">Enter destination file path (default: .env):</Text>
          <TextInput
            defaultValue={envPath}
            onChange={setEnvPath}
            onSubmit={handleImportSomeSubmit}
          />
        </Box>
      )}

      {step === "CONFIRM_DELETE" && (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="warning">
            Are you sure you want to permanently delete Vault "{selectedVaultName}"?
          </StatusMessage>
          <Select
            options={[
              { label: "❌ No, cancel", value: "no" },
              { label: "🗑 Yes, delete permanently", value: "yes" },
            ]}
            onChange={handleConfirmDelete}
          />
        </Box>
      )}
    </Box>
  );
}
