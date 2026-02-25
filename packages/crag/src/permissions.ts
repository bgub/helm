import type { Permission, PermissionPolicy } from "./types.ts";

export class PermissionDeniedError extends Error {
  constructor(qualifiedName: string) {
    super(`Permission denied: ${qualifiedName}`);
    this.name = "PermissionDeniedError";
  }
}

export function resolvePermission(
  qualifiedName: string,
  operationDefault: Permission | undefined,
  policy: PermissionPolicy,
  globalDefault: Permission,
): Permission {
  // 1. Exact match in policy
  if (qualifiedName in policy) {
    return policy[qualifiedName];
  }

  // 2. Wildcard match (e.g. "git.*")
  const dotIndex = qualifiedName.indexOf(".");
  if (dotIndex !== -1) {
    const wildcard = qualifiedName.slice(0, dotIndex) + ".*";
    if (wildcard in policy) {
      return policy[wildcard];
    }
  }

  // 3. Operation's own default
  if (operationDefault !== undefined) {
    return operationDefault;
  }

  // 4. Global default
  return globalDefault;
}
