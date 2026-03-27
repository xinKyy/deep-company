import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  noExternal: [/^@ai-dev-pro\//],
  banner: {
    js: `import{createRequire}from'module';const require=createRequire(import.meta.url);`,
  },
});
