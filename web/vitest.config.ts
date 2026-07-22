import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Ignore macOS AppleDouble sidecars that exFAT drives create next to files.
    exclude: ["**/node_modules/**", "**/dist/**", "**/._*"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // DB integration tests share one Supabase database — don't run files in
    // parallel processes that could stomp each other's rows.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside an RSC build; stub it under vitest.
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
});
