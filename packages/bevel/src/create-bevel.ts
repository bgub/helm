import { PermissionDeniedError, resolvePermission } from "./permissions.ts";
import { search } from "./search.ts";
import type {
  BevelInstance,
  BevelOptions,
  OperationDef,
  Permission,
  PermissionPolicy,
  SearchResult,
  Skill,
} from "./types.ts";

interface RegistryEntry {
  skill: Skill;
  boundOps: Record<string, (...args: unknown[]) => unknown>;
}

export function createBevel(options: BevelOptions = {}): BevelInstance {
  const policy: PermissionPolicy = options.permissions ?? {};
  const globalDefault: Permission = options.defaultPermission ?? "ask";
  const onPermissionRequest = options.onPermissionRequest;

  const registry = new Map<string, RegistryEntry>();

  const instance = {
    use(skill: Skill): BevelInstance {
      const boundOps: Record<string, (...args: unknown[]) => unknown> = {};

      for (const [opName, opDef] of Object.entries(skill.operations) as [
        string,
        OperationDef,
      ][]) {
        const qualifiedName = `${skill.name}.${opName}`;
        const { handler } = opDef;

        boundOps[opName] = async (...args: unknown[]) => {
          const permission = resolvePermission(
            qualifiedName,
            opDef.defaultPermission,
            policy,
            globalDefault,
          );

          if (permission === "deny") {
            throw new PermissionDeniedError(qualifiedName);
          }

          if (permission === "ask") {
            const allowed = await onPermissionRequest?.(qualifiedName, args);
            if (!allowed) {
              throw new PermissionDeniedError(qualifiedName);
            }
          }

          return handler(...args);
        };
      }

      registry.set(skill.name, { skill, boundOps });

      // biome-ignore lint/suspicious/noExplicitAny: dynamic property assignment for skill namespaces
      (instance as any)[skill.name] = boundOps;

      return instance as BevelInstance;
    },

    search(query: string): SearchResult[] {
      return search(query, registry, policy, globalDefault);
    },
  };

  return instance as BevelInstance;
}
