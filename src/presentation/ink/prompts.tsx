import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';

export function CyberpunkFrame({ title, children }: { title?: string, children: React.ReactNode }) {
    return (
        <Box flexDirection="column" borderStyle="single" borderColor="cyan" padding={1}>
            {title && (
                <Box marginBottom={1}>
                    <Text bold color="cyan">λ {title}</Text>
                </Box>
            )}
            {children}
        </Box>
    );
}

// ---------------------------------------------------------------------------
// SELECT COMPONENT
// ---------------------------------------------------------------------------
function SelectPrompt({ message, options, onDone }: { message: string, options: { label: string, value: string }[], onDone: (res: string) => void }) {
    const [index, setIndex] = useState(0);

    useInput((_input, key) => {
        if (key.upArrow) {
            setIndex((prev) => Math.max(0, prev - 1));
        } else if (key.downArrow) {
            setIndex((prev) => Math.min(options.length - 1, prev + 1));
        } else if (key.return) {
            const val = options[index]?.value;
            if (val !== undefined) onDone(val);
        }
    });

    return (
        <CyberpunkFrame>
            <Text bold color="white">{message}</Text>
            <Box flexDirection="column" marginTop={1}>
                {options.map((opt, i) => (
                    <Text key={opt.value} color={i === index ? "magenta" : "white"}>
                        {i === index ? "▶ " : "  "}{opt.label}
                    </Text>
                ))}
            </Box>
        </CyberpunkFrame>
    );
}

export function askSelect(message: string, options: { label: string, value: string }[]): Promise<string> {
    return new Promise((resolve) => {
        let unmount: () => void;
        const onDone = (val: string) => {
            unmount();
            resolve(val);
        };
        const r = render(<SelectPrompt message={message} options={options} onDone={onDone} />);
        unmount = r.unmount;
    });
}

// ---------------------------------------------------------------------------
// MULTI-SELECT COMPONENT
// ---------------------------------------------------------------------------
function MultiSelectPrompt({ message, options, onDone }: { message: string, options: { label: string, value: string }[], onDone: (res: string[]) => void }) {
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useInput((input, key) => {
        if (key.upArrow) {
            setIndex((prev) => Math.max(0, prev - 1));
        } else if (key.downArrow) {
            setIndex((prev) => Math.min(options.length - 1, prev + 1));
        } else if (input === ' ') {
            const val = options[index]?.value;
            if (val !== undefined) {
                setSelected(prev => {
                    const next = new Set(prev);
                    if (next.has(val)) next.delete(val);
                    else next.add(val);
                    return next;
                });
            }
        } else if (key.return) {
            onDone(Array.from(selected));
        }
    });

    return (
        <CyberpunkFrame>
            <Text bold color="white">{message}</Text>
            <Box flexDirection="column" marginTop={1}>
                {options.map((opt, i) => {
                    const isHover = i === index;
                    const isSelected = selected.has(opt.value);
                    return (
                        <Text key={opt.value} color={isHover ? "magenta" : "white"}>
                            {isHover ? "▶ " : "  "}[{isSelected ? "x" : " "}] {opt.label}
                        </Text>
                    );
                })}
            </Box>
        </CyberpunkFrame>
    );
}

export function askMultiSelect(message: string, options: { label: string, value: string }[]): Promise<string[]> {
    return new Promise((resolve) => {
        let unmount: () => void;
        const onDone = (val: string[]) => {
            unmount();
            resolve(val);
        };
        const r = render(<MultiSelectPrompt message={message} options={options} onDone={onDone} />);
        unmount = r.unmount;
    });
}

// ---------------------------------------------------------------------------
// CONFIRM COMPONENT
// ---------------------------------------------------------------------------
function ConfirmPrompt({ message, defaultVal = false, onDone }: { message: string, defaultVal?: boolean, onDone: (res: boolean) => void }) {
    const [val, setVal] = useState(defaultVal);

    useInput((input, key) => {
        if (key.leftArrow || key.rightArrow) {
            setVal(prev => !prev);
        } else if (input.toLowerCase() === 'y') {
            onDone(true);
        } else if (input.toLowerCase() === 'n') {
            onDone(false);
        } else if (key.return) {
            onDone(val);
        }
    });

    return (
        <CyberpunkFrame>
            <Text bold color="white">{message} (Y/n)</Text>
            <Box marginTop={1}>
                <Text color={val ? "cyan" : "gray"}>{val ? "[x] Yes" : "[ ] Yes"}</Text>
                <Text>  </Text>
                <Text color={!val ? "cyan" : "gray"}>{!val ? "[x] No" : "[ ] No"}</Text>
            </Box>
        </CyberpunkFrame>
    );
}

export function askConfirm(message: string, defaultVal: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
        let unmount: () => void;
        const onDone = (val: boolean) => {
            unmount();
            resolve(val);
        };
        const r = render(<ConfirmPrompt message={message} defaultVal={defaultVal} onDone={onDone} />);
        unmount = r.unmount;
    });
}

// ---------------------------------------------------------------------------
// INPUT COMPONENT
// ---------------------------------------------------------------------------
function InputPrompt({ message, defaultVal = '', onDone }: { message: string, defaultVal?: string, onDone: (res: string) => void }) {
    const [val, setVal] = useState('');

    useInput((input, key) => {
        if (key.return) {
            onDone(val || defaultVal);
        } else if (key.backspace || key.delete) {
            setVal(prev => prev.slice(0, -1));
        } else if (input.length === 1 && !key.ctrl && !key.meta) {
            setVal(prev => prev + input);
        }
    });

    return (
        <CyberpunkFrame>
            <Text bold color="white">{message}</Text>
            {defaultVal && <Text color="gray">Default: {defaultVal}</Text>}
            <Box marginTop={1}>
                <Text color="green">λ </Text>
                <Text color="cyan">{val}</Text>
                <Text color="cyan">█</Text>
            </Box>
        </CyberpunkFrame>
    );
}

export function askInput(message: string, defaultVal: string = ''): Promise<string> {
    return new Promise((resolve) => {
        let unmount: () => void;
        const onDone = (val: string) => {
            unmount();
            resolve(val);
        };
        const r = render(<InputPrompt message={message} defaultVal={defaultVal} onDone={onDone} />);
        unmount = r.unmount;
    });
}

export function printDashboardHeader() {
    console.clear();
    const r = render(
        <CyberpunkFrame title="LUMINI CLI v0.1.0">
            <Text color="gray">System Architecture / Core Modules</Text>
        </CyberpunkFrame>
    );
    r.unmount();
}
