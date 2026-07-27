import type { GitDiffResult, GitFileStatus } from "../git/git.js";
export declare function analyzeAndGroupCommits(status: GitFileStatus[], diff: GitDiffResult): Promise<{
    groups: CommitGroup[];
}>;
export interface CommitGroup {
    type: string;
    scope?: string;
    message: string;
    files: string[];
}
