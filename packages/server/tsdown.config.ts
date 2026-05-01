import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts", "./src/client.ts"],
  platform: "node",
  dts: true,
  sourcemap: true,
});
