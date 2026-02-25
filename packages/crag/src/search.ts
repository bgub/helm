import { resolvePermission } from "./permissions.ts";
import type {
  OperationDef,
  Permission,
  PermissionPolicy,
  SearchResult,
  Skill,
} from "./types.ts";

interface RegistryEntry {
  skill: Skill;
}

function scoreMatch(query: string, result: SearchResult): number {
  const q = query.toLowerCase();

  // Exact qualified name match
  if (result.qualifiedName.toLowerCase() === q) return 100;

  // Qualified name contains query
  if (result.qualifiedName.toLowerCase().includes(q)) return 80;

  // Operation name contains query
  if (result.operation.toLowerCase().includes(q)) return 70;

  // Skill name contains query
  if (result.skill.toLowerCase().includes(q)) return 60;

  // Description contains query
  if (result.description.toLowerCase().includes(q)) return 40;

  // Tag match
  if (result.tags.some((t) => t.toLowerCase().includes(q))) return 30;

  return 0;
}

export function search(
  query: string,
  registry: Map<string, RegistryEntry>,
  policy: PermissionPolicy,
  globalDefault: Permission,
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const [, entry] of registry) {
    const { skill } = entry;
    for (const [opName, opDef] of Object.entries(skill.operations) as [
      string,
      OperationDef,
    ][]) {
      const qualifiedName = `${skill.name}.${opName}`;
      const permission = resolvePermission(
        qualifiedName,
        opDef.defaultPermission,
        policy,
        globalDefault,
      );

      results.push({
        skill: skill.name,
        operation: opName,
        qualifiedName,
        description: opDef.description,
        tags: opDef.tags ?? [],
        permission,
      });
    }
  }

  // Filter by query
  const scored = results
    .map((r) => ({ result: r, score: scoreMatch(query, r) }))
    .filter((s) => s.score > 0);

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.result);
}
