import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname ?? ".",
  // The app imports shared adapter code from ../src, so the Vite root stays at
  // frontend/ while the workspace root is watched for module resolution.
  server: {
    port: 5173,
    strictPort: false,
    host: "127.0.0.1",
  },
  envPrefix: "VITE_",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
});
