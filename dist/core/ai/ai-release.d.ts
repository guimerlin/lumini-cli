import { z } from "zod";
declare const ReleaseSchema: z.ZodObject<{
    nextVersion: z.ZodString;
    bumpType: z.ZodEnum<{
        major: "major";
        minor: "minor";
        patch: "patch";
    }>;
    title: z.ZodString;
    summary: z.ZodString;
    changelog: z.ZodString;
    breakingChanges: z.ZodArray<z.ZodString>;
    highlights: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type ReleaseOutput = z.infer<typeof ReleaseSchema>;
export declare function generateRelease(currentVersion: string, commitDiff: string, commitMessages: string[]): Promise<ReleaseOutput>;
export {};
