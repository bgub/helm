import { describe, expect, it } from "vitest";
import {
  PermissionDeniedError,
  resolvePermission,
} from "../src/permissions.ts";

describe("resolvePermission", () => {
  it("returns exact policy match first", () => {
    const result = resolvePermission(
      "git.status",
      "deny",
      { "git.status": "allow" },
      "ask",
    );
    expect(result).toBe("allow");
  });

  it("returns wildcard policy match second", () => {
    const result = resolvePermission(
      "git.status",
      "deny",
      { "git.*": "allow" },
      "ask",
    );
    expect(result).toBe("allow");
  });

  it("returns operation default third", () => {
    const result = resolvePermission("git.status", "deny", {}, "ask");
    expect(result).toBe("deny");
  });

  it("returns global default last", () => {
    const result = resolvePermission("git.status", undefined, {}, "ask");
    expect(result).toBe("ask");
  });

  it("exact match takes precedence over wildcard", () => {
    const result = resolvePermission(
      "git.push",
      undefined,
      { "git.*": "allow", "git.push": "deny" },
      "ask",
    );
    expect(result).toBe("deny");
  });

  it("handles names without dots for wildcard gracefully", () => {
    const result = resolvePermission("nodot", "allow", {}, "ask");
    expect(result).toBe("allow");
  });
});

describe("PermissionDeniedError", () => {
  it("has correct name and message", () => {
    const err = new PermissionDeniedError("git.push");
    expect(err.name).toBe("PermissionDeniedError");
    expect(err.message).toBe("Permission denied: git.push");
    expect(err).toBeInstanceOf(Error);
  });
});
