export declare const command: {
    name: string;
    description: string;
    flags: {
        name: string;
        description: string;
    }[];
    action: (key: string, value: string, options: any) => void;
};
