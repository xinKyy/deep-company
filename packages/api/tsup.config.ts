import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  noExternal: [/^@ai-dev-pro\//],
});
