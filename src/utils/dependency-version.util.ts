import type { PackageJsonInfo } from "../core/interfaces/file-system-client.interface.js";

/**
 * Extrai o "nome do pacote" a partir de um import source externo.
 * Lida com pacotes com escopo (@scope/pkg/subpath -> @scope/pkg)
 * e pacotes simples (pkg/subpath -> pkg).
 */
export function extractPackageName(source: string): string {
  const parts = source.split("/");
  if (source.startsWith("@")) {
    return parts.slice(0, 2).join("/");
  }
  return parts[0] ?? source;
}

export function findVersionInPackageJson(
  packageName: string,
  pkgInfo: PackageJsonInfo | null,
): string {
  if (!pkgInfo) return "latest";
  return pkgInfo.dependencies[packageName] ?? pkgInfo.devDependencies[packageName] ?? "latest";
}
