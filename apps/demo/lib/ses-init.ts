import "ses";

const KEY = "__ses_lockdown_done__" as const;
const g = globalThis as unknown as Record<string, boolean | undefined>;

if (!g[KEY]) {
  lockdown({
    errorTaming: "unsafe",
    overrideTaming: "moderate",
    consoleTaming: "unsafe",
    stackFiltering: "verbose",
  });
  g[KEY] = true;
}
