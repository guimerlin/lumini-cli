import { useState, useEffect, useMemo } from "react";
import { Box, Text } from "ink";
import { Select, TextInput, Spinner, StatusMessage } from "@inkjs/ui";
import type { useComponents } from "../use-components.hook.js";
import type { useVault } from "../../../vault/presentation/use-vault.hook.js";
import type { SaveStrategy } from "../../../../shared/core/entities/metadata.entity.js";
import { FileSystemClient } from "../../../../shared/infrastructure/clients/file-system.client.js";
import { AstParserClient } from "../../../../shared/infrastructure/parsers/ast-parser.client.js";
import path from "node:path";

interface SaveWizardProps {
  componentsHook: ReturnType<typeof useComponents>;
  vaultHook: ReturnType<typeof useVault>;
  initialPath?: string; // If passed from CLI
  onBack: () => void;
}

type Step =
  | "INPUT_PATH"
  | "SAVE_TYPE_CHOICE"
  | "INPUT_VAULT_NAME"
  | "INPUT_COMP_NAME"
  | "ENV_VAULT_OPTION"
  | "SELECT_STRATEGY"
  | "SELECT_TAG"
  | "INPUT_NEW_TAG"
  | "PROCESSING"
  | "SUCCESS";

export function SaveWizard({ componentsHook, vaultHook, initialPath, onBack }: SaveWizardProps) {
  const { saveComponent, components } = componentsHook;
  const { saveVault, parseEnvContent } = vaultHook;
  
  const fsClient = useMemo(() => new FileSystemClient(), []);
  const astParser = useMemo(() => new AstParserClient(), []);

  const [step, setStep] = useState<Step>("INPUT_PATH");
  const [targetPath, setTargetPath] = useState("");
  const [compName, setCompName] = useState("");
  const [vaultName, setVaultName] = useState("");
  
  // States for detected files/imports
  const [isDir, setIsDir] = useState(false);
  const [, setSaveType] = useState<"library" | "vault">("library");
  const [, setIsEnvOnly] = useState(false);
  const [envFilesList, setEnvFilesList] = useState<string[]>([]);
  const [envFileAbsPath, setEnvFileAbsPath] = useState<string | null>(null);
  const [envVaultOption, setEnvVaultOption] = useState<"keep" | "vault" | "ignore">("keep");
  const [, setHasLocalImports] = useState(false);
  const [recommendedStrategy, setRecommendedStrategy] = useState<SaveStrategy>("raw");
  const [selectedStrategy, setSelectedStrategy] = useState<SaveStrategy>("raw");

  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (initialPath) {
      handlePathSubmit(initialPath);
    }
  }, [initialPath]);

  const handlePathSubmit = async (inputPath: string) => {
    if (!inputPath) return;
    setIsLoading(true);
    setStatus(null);
    try {
      const targetAbsPath = path.resolve(process.cwd(), inputPath);
      const exists = await fsClient.exists(targetAbsPath);
      if (!exists) {
        setStatus({ type: "error", text: `Path not found: ${inputPath}` });
        setIsLoading(false);
        return;
      }
      setTargetPath(targetAbsPath);
      
      const dirCheck = await fsClient.isDirectory(targetAbsPath);
      setIsDir(dirCheck);

      // Check for .env files
      let envOnly = false;
      let envsList: string[] = [];
      if (dirCheck) {
        const allFiles = await fsClient.listFilesRecursively(targetAbsPath, ["*"]);
        envOnly = allFiles.length > 0 && allFiles.every((f) => path.basename(f).startsWith(".env"));
        envsList = allFiles;
      } else if (path.basename(targetAbsPath).startsWith(".env")) {
        envOnly = true;
        envsList = [targetAbsPath];
      }

      setIsEnvOnly(envOnly);
      setEnvFilesList(envsList);

      const defaultName = dirCheck
        ? path.basename(targetAbsPath)
        : path.basename(targetAbsPath, path.extname(targetAbsPath));
      setCompName(defaultName);
      setVaultName(defaultName);

      setIsLoading(false);

      if (envOnly) {
        setStep("SAVE_TYPE_CHOICE");
      } else {
        setStep("INPUT_COMP_NAME");
      }
    } catch (err) {
      setStatus({ type: "error", text: `Error checking path: ${(err as Error).message}` });
      setIsLoading(false);
    }
  };

  const handleSaveTypeChoice = (choice: string) => {
    if (choice === "vault") {
      setSaveType("vault");
      setStep("INPUT_VAULT_NAME");
    } else {
      setSaveType("library");
      setStep("INPUT_COMP_NAME");
    }
  };

  const handleVaultNameSubmit = async (name: string) => {
    if (!name) return;
    setIsLoading(true);
    try {
      const combinedVars: Record<string, string> = {};
      for (const file of envFilesList) {
        const content = await fsClient.readFile(file);
        Object.assign(combinedVars, parseEnvContent(content));
      }
      await saveVault(name, combinedVars);
      setSummary(`✓ Environment variables successfully saved to Vault "${name}".`);
      setStep("SUCCESS");
    } catch (err) {
      setStatus({ type: "error", text: `Failed to save vault: ${(err as Error).message}` });
      setStep("INPUT_PATH");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompNameSubmit = async (name: string) => {
    if (!name) return;
    setCompName(name);
    setIsLoading(true);

    try {
      // Scan for .env files within component
      let envFile: string | null = null;
      if (isDir) {
        const allFiles = await fsClient.listFilesRecursively(targetPath, ["*"]);
        const found = allFiles.find((f) => path.basename(f).startsWith(".env"));
        if (found) envFile = found;
      } else if (path.basename(targetPath).startsWith(".env")) {
        envFile = targetPath;
      }
      setEnvFileAbsPath(envFile);

      // Check JS/TS files and imports
      let hasJsTs = false;
      if (isDir) {
        const allFiles = await fsClient.listFilesRecursively(targetPath, ["*"]);
        hasJsTs = allFiles.some((f) => {
          const ext = path.extname(f).toLowerCase();
          return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext);
        });
      } else {
        const ext = path.extname(targetPath).toLowerCase();
        hasJsTs = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext);
      }

      let localImports = false;
      if (hasJsTs && !isDir) {
        try {
          const { imports } = await astParser.parseFile(targetPath);
          localImports = imports.some((i) => i.isRelative);
        } catch {
          // ignore
        }
      }
      setHasLocalImports(localImports);

      // Resolve strategy
      const strategy: SaveStrategy = !hasJsTs
        ? "raw"
        : localImports
        ? "folder"
        : "raw";
      setRecommendedStrategy(strategy);
      setSelectedStrategy(strategy);

      setIsLoading(false);

      if (envFile) {
        setStep("ENV_VAULT_OPTION");
      } else {
        setStep("SELECT_STRATEGY");
      }
    } catch (err) {
      setStatus({ type: "error", text: `Analysis failed: ${(err as Error).message}` });
      setIsLoading(false);
    }
  };

  const handleEnvVaultChoice = (choice: string) => {
    setEnvVaultOption(choice as "keep" | "vault" | "ignore");
    setStep("SELECT_STRATEGY");
  };

  const handleStrategySelected = (strategy: string) => {
    setSelectedStrategy(strategy as SaveStrategy);
    setStep("SELECT_TAG");
  };

  const handleTagSelected = (tag: string) => {
    if (tag === "create_new") {
      setStep("INPUT_NEW_TAG");
    } else {
      executeSaveComponent(false, tag, selectedStrategy, envVaultOption);
    }
  };

  const handleNewTagSubmit = (newTag: string) => {
    if (!newTag) return;
    const cleanTag = newTag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    executeSaveComponent(false, cleanTag, selectedStrategy, envVaultOption);
  };

  const executeSaveComponent = async (
    structure: boolean,
    tag: string,
    strategy: SaveStrategy,
    envOpt: "keep" | "vault" | "ignore"
  ) => {
    setIsLoading(true);
    setStatus(null);

    let excludeFiles: string[] = [];
    let savedVaultName: string | undefined;

    try {
      if (envFileAbsPath) {
        const envFilename = path.basename(envFileAbsPath);
        const relativeEnvPath = isDir ? path.relative(targetPath, envFileAbsPath) : envFilename;

        if (envOpt === "vault") {
          const vName = compName;
          const envContent = await fsClient.readFile(envFileAbsPath);
          const parsed = parseEnvContent(envContent);
          await saveVault(vName, parsed);
          excludeFiles.push(relativeEnvPath);
          savedVaultName = vName;
        } else if (envOpt === "ignore") {
          excludeFiles.push(relativeEnvPath);
        }
      }

      const metadata = await saveComponent({
        name: compName,
        targetAbsolutePath: targetPath,
        strategy,
        tag: tag === "_general" ? undefined : tag,
        structureOnly: structure,
        excludeFiles,
        associatedVault: savedVaultName,
      });

      const displayTag = tag === "_general" ? "" : `@[${tag}]/`;
      let text = `✓ "${displayTag}${compName}" saved successfully with strategy "${strategy}".\n`;
      text += `  Files: ${metadata.files.join(", ")}\n`;
      if (savedVaultName) {
        text += `  ✓ Vault "${savedVaultName}" created from environmental variables.`;
      }
      setSummary(text);
      setStep("SUCCESS");
    } catch (err) {
      setStatus({ type: "error", text: `Failed to save: ${(err as Error).message}` });
      setStep("INPUT_PATH");
    } finally {
      setIsLoading(false);
    }
  };

  // List existing tags
  const existingTags = Array.from(new Set(components.map((c) => c.tag).filter(Boolean))) as string[];

  if (isLoading) {
    return (
      <Box padding={1}>
        <Spinner label="Analyzing and saving..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      {status && (
        <StatusMessage variant={status.type}>{status.text}</StatusMessage>
      )}

      {step === "INPUT_PATH" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="yellow">📤 Save File or Folder to Library</Text>
          <Text color="white">Enter the file or folder path:</Text>
          <TextInput
            placeholder="src/components/MyComponent"
            onChange={setTargetPath}
            onSubmit={handlePathSubmit}
          />
        </Box>
      )}

      {step === "SAVE_TYPE_CHOICE" && (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="info">
            Path contains only environment variables (.env files).
          </StatusMessage>
          <Text color="white">How would you like to save them?</Text>
          <Select
            options={[
              { label: "🔑 Save as an Environment Vault (Secure)", value: "vault" },
              { label: "📦 Save as a regular Code Component", value: "library" },
            ]}
            onChange={handleSaveTypeChoice}
          />
        </Box>
      )}

      {step === "INPUT_VAULT_NAME" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="yellow">🔑 Vault Name</Text>
          <Text color="white">Enter Vault name (default: {vaultName}):</Text>
          <TextInput
            defaultValue={vaultName}
            onChange={setVaultName}
            onSubmit={handleVaultNameSubmit}
          />
        </Box>
      )}

      {step === "INPUT_COMP_NAME" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="yellow">📦 Component Name</Text>
          <Text color="white">Enter Component name (default: {compName}):</Text>
          <TextInput
            defaultValue={compName}
            onChange={setCompName}
            onSubmit={handleCompNameSubmit}
          />
        </Box>
      )}

      {step === "ENV_VAULT_OPTION" && envFileAbsPath && (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="info">
            Found environment file "{path.basename(envFileAbsPath)}" within component path.
          </StatusMessage>
          <Text color="white">Select action for this environment file:</Text>
          <Select
            options={[
              { label: "🔑 Extract & save to a secure Vault (Recommended)", value: "vault" },
              { label: "📦 Keep it inside the component code", value: "keep" },
              { label: "❌ Exclude/Ignore this file", value: "ignore" },
            ]}
            onChange={handleEnvVaultChoice}
          />
        </Box>
      )}

      {step === "SELECT_STRATEGY" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="yellow">🛠 Select Resolution Strategy</Text>
          <Text color="gray">Recommended: {recommendedStrategy}</Text>
          <Select
            options={[
              {
                label: `raw - copy file as is ${recommendedStrategy === "raw" ? "(Recommended)" : ""}`,
                value: "raw",
              },
              {
                label: `deps - trace & check external deps ${recommendedStrategy === "deps" ? "(Recommended)" : ""}`,
                value: "deps",
              },
              {
                label: `bundle - bundle all imports into one file ${recommendedStrategy === "bundle" ? "(Recommended)" : ""}`,
                value: "bundle",
              },
              {
                label: `folder - flatten folder and rewrite relative imports ${recommendedStrategy === "folder" ? "(Recommended)" : ""}`,
                value: "folder",
              },
            ]}
            onChange={handleStrategySelected}
          />
        </Box>
      )}

      {step === "SELECT_TAG" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="yellow">🏷 Organize under Tag / Group</Text>
          <Select
            options={[
              { label: "📁 General (no tag)", value: "_general" },
              { label: "🆕 Create a new tag...", value: "create_new" },
              ...existingTags.map((t) => ({ label: `📁 @${t}`, value: t })),
            ]}
            onChange={handleTagSelected}
          />
        </Box>
      )}

      {step === "INPUT_NEW_TAG" && (
        <Box flexDirection="column" gap={1}>
          <Text bold color="yellow">🆕 Create New Tag</Text>
          <Text color="white">Enter name for the new tag (alphanumeric only):</Text>
          <TextInput
            placeholder="auth"
            onSubmit={handleNewTagSubmit}
          />
        </Box>
      )}

      {step === "SUCCESS" && (
        <Box flexDirection="column" gap={1}>
          <StatusMessage variant="success">Component saved successfully!</StatusMessage>
          <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1} marginY={1}>
            <Text color="white">{summary}</Text>
          </Box>
          <Select
            options={[{ label: "◀ Return to Dashboard", value: "ok" }]}
            onChange={onBack}
          />
        </Box>
      )}
    </Box>
  );
}
