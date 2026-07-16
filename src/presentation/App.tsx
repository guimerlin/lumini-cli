import { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Select } from "@inkjs/ui";
import { useComponents } from "../features/components/presentation/use-components.hook.js";
import { useVault } from "../features/vault/presentation/use-vault.hook.js";
import { useConfig } from "../features/config/presentation/use-config.hook.js";
import { AddWizard } from "../features/components/presentation/components/AddWizard.js";
import { SaveWizard } from "../features/components/presentation/components/SaveWizard.js";
import { VaultManager } from "../features/vault/presentation/components/VaultManager.js";

type Screen = "DASHBOARD" | "ADD_WIZARD" | "SAVE_WIZARD" | "VAULT_MANAGER";

interface AppProps {
  initialScreen?: Screen;
  targetArg?: string; // e.g. path to save or component name to add
}

export default function App({ initialScreen = "DASHBOARD", targetArg }: AppProps) {
  const { exit } = useApp();
  
  const componentsHook = useComponents();
  const vaultHook = useVault();
  const configHook = useConfig();

  const { components, loadComponents } = componentsHook;
  const { vaults, loadVaults } = vaultHook;
  const { loadConfig } = configHook;

  const [screen, setScreen] = useState<Screen>(initialScreen);

  useEffect(() => {
    loadComponents();
    loadVaults();
    loadConfig();
  }, [loadComponents, loadVaults, loadConfig]);

  // Global keybindings
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
    if (screen === "DASHBOARD" && (input === "q" || input === "Q")) {
      exit();
    }
    // Allow escaping back to dashboard from sub-wizards on Esc
    if (key.escape && screen !== "DASHBOARD") {
      setScreen("DASHBOARD");
      loadComponents();
      loadVaults();
    }
  });

  const handleMenuChange = (value: string) => {
    if (value === "exit") {
      exit();
      return;
    }
    if (value === "add") {
      setScreen("ADD_WIZARD");
    } else if (value === "save") {
      setScreen("SAVE_WIZARD");
    } else if (value === "vault") {
      setScreen("VAULT_MANAGER");
    }
  };

  // Group components by tag
  const groupedComponents: Record<string, typeof components> = {};
  for (const c of components) {
    const tag = c.tag || "_general";
    groupedComponents[tag] = groupedComponents[tag] ?? [];
    groupedComponents[tag].push(c);
  }

  return (
    <Box flexDirection="column" gap={1} padding={1}>
      {/* HEADER */}
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
        alignItems="center"
      >
        <Text bold color="cyan">✨ L U M I N I   C L I  ✨</Text>
        <Text color="gray">AST-Based Code Library & Secure Environment Vaults</Text>
      </Box>

      {screen === "DASHBOARD" && (
        <Box flexDirection="column" gap={1}>
          {/* TWO COLUMN CONTENT */}
          <Box flexDirection="row" gap={4} width="100%">
            
            {/* COLUMN LEFT: COMPONENTS */}
            <Box
              flexDirection="column"
              width="50%"
              borderStyle="round"
              borderColor="magenta"
              paddingX={1}
              minHeight={10}
            >
              <Text bold color="magenta">📦 CODE COMPONENTS LIBRARY</Text>
              <Text color="gray">──────────────────────────────</Text>
              
              {components.length === 0 ? (
                <Text color="gray" italic>No components stored yet.</Text>
              ) : (
                Object.entries(groupedComponents).map(([tag, comps]) => (
                  <Box key={tag} flexDirection="column" marginBottom={1}>
                    <Text bold color="yellow">
                      📁 {tag === "_general" ? "General components" : `@${tag}`}
                    </Text>
                    {comps.map((c) => {
                      const strategyBadge = `[${c.strategy}]`;
                      const structBadge = c.structureOnly ? " [structure]" : "";
                      return (
                        <Box key={c.name} flexDirection="row" gap={1} marginLeft={2}>
                          <Text color="white">• {c.name}</Text>
                          <Text color="cyan">{strategyBadge}</Text>
                          {structBadge && <Text color="gray">{structBadge}</Text>}
                        </Box>
                      );
                    })}
                  </Box>
                ))
              )}
            </Box>

            {/* COLUMN RIGHT: VAULTS */}
            <Box
              flexDirection="column"
              width="50%"
              borderStyle="round"
              borderColor="yellow"
              paddingX={1}
              minHeight={10}
            >
              <Text bold color="yellow">🔑 SECURE ENVIRONMENT VAULTS</Text>
              <Text color="gray">──────────────────────────────</Text>

              {vaults.length === 0 ? (
                <Text color="gray" italic>No environment vaults stored yet.</Text>
              ) : (
                vaults.map((v) => (
                  <Box key={v.name} flexDirection="column" marginBottom={1} marginLeft={2}>
                    <Text bold color="white">
                      🔒 Vault: {v.name}
                    </Text>
                    <Text color="gray">
                      ({Object.keys(v.variables).length} variables stored securely)
                    </Text>
                  </Box>
                ))
              )}
            </Box>
          </Box>

          {/* ACTIONS MENU */}
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Text bold color="white">⚡ Choose Action:</Text>
            <Select
              options={[
                { label: "📥 Inject Component(s) into current project", value: "add" },
                { label: "📤 Save File/Folder into Library", value: "save" },
                { label: "🔑 Manage Environment Vaults", value: "vault" },
                { label: "❌ Exit Lumini", value: "exit" },
              ]}
              onChange={handleMenuChange}
            />
            <Text color="gray">Shortcut: Press 'q' or 'Ctrl+C' to exit</Text>
          </Box>
        </Box>
      )}

      {screen === "ADD_WIZARD" && (
        <AddWizard
          componentsHook={componentsHook}
          vaultHook={vaultHook}
          configHook={configHook}
          initialComponent={targetArg}
          onBack={() => {
            setScreen("DASHBOARD");
            loadComponents();
            loadVaults();
          }}
        />
      )}

      {screen === "SAVE_WIZARD" && (
        <SaveWizard
          componentsHook={componentsHook}
          vaultHook={vaultHook}
          initialPath={targetArg}
          onBack={() => {
            setScreen("DASHBOARD");
            loadComponents();
            loadVaults();
          }}
        />
      )}

      {screen === "VAULT_MANAGER" && (
        <VaultManager
          vaultHook={vaultHook}
          configHook={configHook}
          onBack={() => {
            setScreen("DASHBOARD");
            loadComponents();
            loadVaults();
          }}
        />
      )}
    </Box>
  );
}
