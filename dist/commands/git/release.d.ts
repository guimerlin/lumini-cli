export declare const command: {
    name: string;
    description: string;
    flags: {
        name: string;
        description: string;
    }[];
    action(options: {
        dryRun?: boolean;
        tag?: boolean;
        output?: string;
    }): Promise<void>;
};
