import { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Select, MultiSelect, TextInput, Spinner, StatusMessage } from "@inkjs/ui";
import type { useComponents } from "../use-components.hook.js";
import type { useVault } from "../../../vault/presentation/use-vault.hook.js";
import type { useConfig } from "../../../config/presentation/use-config.hook.js";
import type { ComponentMetadata } from "../../../../shared/core/entities/metadata.entity.js";
import path from "node:path";
import fs from "fs-extra";

interface AddWizardProps {
  componentsHook: ReturnType<typeof useComponents>;
  vaultHook: ReturnType<typeof useVault>;
  configHook: ReturnType<typeof useConfig>;
  initialComponent?: string; // If passed from CLI
  onBack: () => void;
}

type Step =
  | "INIT_CHOICE"
  | "SELECT_COMPONENTS"
  | "SELECT_TAG"
  | "CONFIRM_OVERWRITE"
  | "ASK_DESTINATION"
  | "ASK_DEPENDENCIES"
  | "ASK_VAULT_IMPORT"
  | "SELECT_VAULT_KEYS"
  | "PROCESSING"
  | "SUMMARY";

export function AddWizard({ componentsHook, vaultHook, configHook, initialComponent, onBack }: AddWizardProps) {
  const { components, isLoading: compsLoading, loadComponents, addComponent } = componentsHook;
  const { vaults, loadVaults, mergeVaultVariables } = vaultHook;
  const { config, loadConfig, registerImport, registerVaultImport } = configHook;

  const [step, setStep] = useState<Step>("INIT_CHOICE");
  const [selectedComps, setSelectedComps] = useState<ComponentMetadata[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); // Iterator for selected components to configure
  const [destPath, setDestPath] = useState(".");
  const [status, setStatus] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  
  // States for active component being processed
  const [activeComp, setActiveComp] = useState<ComponentMetadata | null>(null);
  const [missingDeps, setMissingDeps] = useState<{ name: string; version: string }[]>([]);
  const [associatedVaultName, setAssociatedVaultName] = useState<string | null>(null);
  const [summaryMessages, setSummaryMessages] = useState<string[]>([]);

  useEffect(() => {
    loadComponents();
    loadVaults();
    loadConfig();
  }, [loadComponents, loadVaults, loadConfig]);

  // Handle initial CLI direct-interactive trigger
  useEffect(() => {
    if (initialComponent && components.length > 0) {
      const comp = components.find(
        (c) => c.name === initialComponent || (c.tag && `@${c.tag}/${c.name}` === initialComponent)
      );
      if (comp) {
        setSelectedComps([comp]);
        setStep("ASK_DESTINATION");
        setActiveComp(comp);
        setDestPath(config.defaultImportPath || ".");
      } else {
        setStatus({
          type: "error",
          text: `Component "${initialComponent}" not found in the library.`,
        });
      }
    }
  }, [initialComponent, components, config]);

  const handleInitChoice = (choice: string) => {
    if (choice === "back") {
      onBack();
      return;
    }
    if (choice === "individual") {
      setStep("SELECT_COMPONENTS");
    } else if (choice === "tag") {
      setStep("SELECT_TAG");
    }
  };

  const handleComponentsSelected = (compNames: string[]) => {
    if (compNames.length === 0) {
      setStep("INIT_CHOICE");
      return;
    }

    const selected = components.filter((c) => {
      const fullName = c.tag && c.tag !== "_general" ? `@${c.tag}/${c.name}` : c.name;
      return compNames.includes(fullName);
    });

    setSelectedComps(selected);
    setCurrentIndex(0);
    startConfiguringComponent(selected[0]!);
  };

  const handleTagSelected = (tag: string) => {
    if (tag === "back") {
      setStep("INIT_CHOICE");
      return;
    }
    const selected = components.filter((c) => c.tag === tag);
    setSelectedComps(selected);
    setCurrentIndex(0);
    startConfiguringComponent(selected[0]!);
  };

  const startConfiguringComponent = (comp: ComponentMetadata) => {
    setActiveComp(comp);
    setDestPath(config.defaultImportPath || ".");
    
    // Check if already imported
    const isAlreadyImported = config.importedComponents && comp.name in config.importedComponents;
    if (isAlreadyImported) {
      setStep("CONFIRM_OVERWRITE");
    } else {
      setStep("ASK_DESTINATION");
    }
  };

  const handleOverwriteChoice = (choice: string) => {
    if (choice === "no") {
      moveToNextOrSummary();
    } else {
      setStep("ASK_DESTINATION");
    }
  };

  const handleDestinationSubmit = async (value: string) => {
    if (!activeComp) return;
    setStep("PROCESSING");
    
    try {
      const destination = value || ".";
      const destAbsPath = path.resolve(process.cwd(), destination);
      
      const result = await addComponent(activeComp.name, destAbsPath);
      await registerImport(activeComp.name, result.metadata.tag, result.writtenFiles);

      const displayTag = result.metadata.tag && result.metadata.tag !== "_general" ? `@[${result.metadata.tag}]/` : "";
      let successMsg = `✓ "${displayTag}${result.metadata.name}" added successfully.`;
      if (result.writtenFiles.length > 0) {
        successMsg += ` (${result.writtenFiles.length} file(s) written)`;
      }
      setSummaryMessages((prev) => [...prev, successMsg]);

      // Flow transitions: Check dependencies
      if (result.missingDependencies.length > 0) {
        setMissingDeps(result.missingDependencies);
        setStep("ASK_DEPENDENCIES");
      } else if (result.metadata.associatedVault) {
        setAssociatedVaultName(result.metadata.associatedVault);
        setStep("ASK_VAULT_IMPORT");
      } else {
        moveToNextOrSummary();
      }
    } catch (err) {
      setStatus({
        type: "error",
        text: `Failed to inject component: ${(err as Error).message}`,
      });
      setStep("INIT_CHOICE");
    }
  };

  const handleInstallDeps = async (choice: string) => {
    if (choice === "yes" && activeComp) {
      try {
        const destAbsPath = path.resolve(process.cwd(), destPath);
        // Find package.json
        let currentDir = destAbsPath;
        let pkgJsonPath: string | null = null;
        
        while (true) {
          const candidate = path.join(currentDir, "package.json");
          if (await fs.pathExists(candidate)) {
            pkgJsonPath = candidate;
            break;
          }
          const parent = path.dirname(currentDir);
          if (parent === currentDir) break;
          currentDir = parent;
        }

        if (pkgJsonPath) {
          const pkgJson = await fs.readJson(pkgJsonPath);
          pkgJson.dependencies = pkgJson.dependencies ?? {};
          for (const dep of missingDeps) {
            pkgJson.dependencies[dep.name] = dep.version;
          }
          await fs.writeJson(pkgJsonPath, pkgJson, { spaces: 2 });
          setSummaryMessages((prev) => [
            ...prev,
            `  ✓ Installed dependencies in package.json: ${missingDeps.map((d) => d.name).join(", ")}`,
          ]);
        } else {
          setSummaryMessages((prev) => [
            ...prev,
            `  ⚠ package.json not found. Install manually: ${missingDeps.map((d) => `${d.name}@${d.version}`).join(" ")}`,
          ]);
        }
      } catch (err) {
        setSummaryMessages((prev) => [
          ...prev,
          `  ✗ Failed to edit package.json: ${(err as Error).message}`,
        ]);
      }
    } else {
      setSummaryMessages((prev) => [
        ...prev,
        `  ⚠ Dependencies skipped: ${missingDeps.map((d) => d.name).join(", ")}`,
      ]);
    }

    if (activeComp?.associatedVault) {
      setAssociatedVaultName(activeComp.associatedVault);
      setStep("ASK_VAULT_IMPORT");
    } else {
      moveToNextOrSummary();
    }
  };

  const handleVaultImportChoice = async (choice: string) => {
    if (choice === "skip" || !associatedVaultName) {
      moveToNextOrSummary();
      return;
    }

    const targetVault = vaults.find((v) => v.name === associatedVaultName);
    if (!targetVault) {
      moveToNextOrSummary();
      return;
    }

    if (choice === "all") {
      try {
        const targetEnvFile = path.resolve(process.cwd(), ".env");
        await mergeVaultVariables(targetEnvFile, targetVault.variables);
        await registerVaultImport(associatedVaultName, Object.keys(targetVault.variables));
        setSummaryMessages((prev) => [
          ...prev,
          `  ✓ Vault "${associatedVaultName}": All variables imported to .env`,
        ]);
      } catch (err) {
        setSummaryMessages((prev) => [
          ...prev,
          `  ✗ Vault "${associatedVaultName}" import failed: ${(err as Error).message}`,
        ]);
      }
      moveToNextOrSummary();
    } else if (choice === "select") {
      setStep("SELECT_VAULT_KEYS");
    }
  };

  const handleVaultKeysSelected = async (keys: string[]) => {
    if (keys.length === 0 || !associatedVaultName) {
      moveToNextOrSummary();
      return;
    }

    const targetVault = vaults.find((v) => v.name === associatedVaultName);
    if (!targetVault) {
      moveToNextOrSummary();
      return;
    }

    try {
      const varsToImport: Record<string, string> = {};
      for (const key of keys) {
        varsToImport[key] = targetVault.variables[key] as string;
      }
      const targetEnvFile = path.resolve(process.cwd(), ".env");
      await mergeVaultVariables(targetEnvFile, varsToImport);
      await registerVaultImport(associatedVaultName, keys);
      setSummaryMessages((prev) => [
        ...prev,
        `  ✓ Vault "${associatedVaultName}": ${keys.length} variable(s) imported to .env`,
      ]);
    } catch (err) {
      setSummaryMessages((prev) => [
        ...prev,
        `  ✗ Vault "${associatedVaultName}" import failed: ${(err as Error).message}`,
      ]);
    }
    moveToNextOrSummary();
  };

  const moveToNextOrSummary = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < selectedComps.length) {
      setCurrentIndex(nextIndex);
      startConfiguringComponent(selectedComps[nextIndex]!);
    } else {
      setStep("SUMMARY");
    }
  };

  // Unique tags list
  const tagsList = Array.from(new Set(components.map((c) => c.tag).filter(Boolean))) as string[];

  if (compsLoading) {
    return (
      <Box padding={1}>
        <Spinner label="Loading library components..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      {status && (
        <StatusMessage variant={status.type}>{status.text}</StatusMessage>
      )}

      {step === "INIT_CHOICE" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="magenta">📥 Inject Component(s)</Text>
          <Text color="white">Choose how you want to select components:</Text>
          <Select
            options={[
              { label: "🎛 Select individual components", value: "individual" },
              { label: "🏷 Import entire tag/library group", value: "tag" },
              { label: "◀ Back to Dashboard", value: "back" },
            ]}
            onChange={handleInitChoice}
          />
        </Box>
      )}

      {step === "SELECT_COMPONENTS" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="magenta">🎛 Select Components to Inject</Text>
          <Text color="gray">Use Space to select components, Enter to confirm:</Text>
          {components.length === 0 ? (
            <Text color="gray">No components saved. Save a component first.</Text>
          ) : (
            <MultiSelect
              options={components.map((c) => {
                const tagPrefix = c.tag && c.tag !== "_general" ? `@${c.tag}/` : "";
                const suffix = c.structureOnly ? " (structure)" : "";
                return {
                  label: `${tagPrefix}${c.name}${suffix}`,
                  value: tagPrefix + c.name,
                };
              })}
              onChange={handleComponentsSelected}
            />
          )}
        </Box>
      )}

      {step === "SELECT_TAG" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="magenta">🏷 Select Tag Group to Inject</Text>
          {tagsList.length === 0 ? (
            <Box flexDirection="column" gap={1}>
              <Text color="gray">No tags defined yet.</Text>
              <Select
                options={[{ label: "◀ Back", value: "back" }]}
                onChange={handleTagSelected}
              />
            </Box>
          ) : (
            <Select
              options={[
                ...tagsList.map((tag) => ({
                  label: `@${tag} (${components.filter((c) => c.tag === tag).length} components)`,
                  value: tag,
                })),
                { label: "◀ Back", value: "back" },
              ]}
              onChange={handleTagSelected}
            />
          )}
        </Box>
      )}

      {step === "CONFIRM_OVERWRITE" && activeComp && (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="warning">
            Component "{activeComp.name}" is already imported in this project.
          </StatusMessage>
          <Text color="white">Do you want to overwrite it?</Text>
          <Select
            options={[
              { label: "❌ No, skip this component", value: "no" },
              { label: "♻ Yes, overwrite", value: "yes" },
            ]}
            onChange={handleOverwriteChoice}
          />
        </Box>
      )}

      {step === "ASK_DESTINATION" && activeComp && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="cyan">📥 Injecting component {currentIndex + 1} of {selectedComps.length}: {activeComp.name}</Text>
          <Text color="white">Destination folder (default: {config.defaultImportPath || "."}):</Text>
          <TextInput
            defaultValue={destPath}
            onChange={setDestPath}
            onSubmit={handleDestinationSubmit}
          />
        </Box>
      )}

      {step === "ASK_DEPENDENCIES" && activeComp && (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="warning">
            Missing {missingDeps.length} dependency(ies) for {activeComp.name}
          </StatusMessage>
          <Text color="white">Would you like to auto-add these to package.json?</Text>
          <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
            {missingDeps.map((d) => (
              <Text key={d.name} color="gray">  - {d.name}: {d.version}</Text>
            ))}
          </Box>
          <Select
            options={[
              { label: "✅ Yes, add dependencies", value: "yes" },
              { label: "❌ No, skip them", value: "no" },
            ]}
            onChange={handleInstallDeps}
          />
        </Box>
      )}

      {step === "ASK_VAULT_IMPORT" && activeComp && associatedVaultName && (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="info">
            Component "{activeComp.name}" is linked to environment Vault "{associatedVaultName}".
          </StatusMessage>
          <Text color="white">Select vault action:</Text>
          <Select
            options={[
              { label: "📥 Import ALL variables to .env", value: "all" },
              { label: "🎛 Select specific variables to import", value: "select" },
              { label: "❌ Skip importing vault variables", value: "skip" },
            ]}
            onChange={handleVaultImportChoice}
          />
        </Box>
      )}

      {step === "SELECT_VAULT_KEYS" && associatedVaultName && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="cyan">🎛 Select Variables from Vault: {associatedVaultName}</Text>
          <Text color="gray">Use Space to select, Enter to confirm:</Text>
          {vaults.find((v) => v.name === associatedVaultName) ? (
            <MultiSelect
              options={Object.keys(vaults.find((v) => v.name === associatedVaultName)!.variables).map((k) => ({
                label: k,
                value: k,
              }))}
              onChange={handleVaultKeysSelected}
            />
          ) : (
            <Text color="red">Vault data not found.</Text>
          )}
        </Box>
      )}

      {step === "PROCESSING" && (
        <Box padding={1}>
          <Spinner label="Processing injection..." />
        </Box>
      )}

      {step === "SUMMARY" && (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="success">All tasks processed successfully!</StatusMessage>
          <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1} marginY={1}>
            {summaryMessages.map((msg, i) => (
              <Text key={i} color="white">{msg}</Text>
            ))}
          </Box>
          <Select
            options={[{ label: "◀ Return to Dashboard", value: "ok" }]}
            onChange={() => {
              onBack();
              setSummaryMessages([]);
            }}
          />
        </Box>
      )}
    </Box>
  );
}
