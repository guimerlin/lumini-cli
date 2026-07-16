export interface ComponentMetadata {
  name: string;
  originalPath: string;
  strategy: 'raw' | 'deps' | 'bundle' | 'folder';
  dependencies: Record<string, string>; // external dependencies e.g., { "lucide-react": "^0.260.0" }
  files: string[]; // relative paths of files saved
  createdAt: string;
}
