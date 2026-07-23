import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Ignore macOS AppleDouble sidecars that exFAT drives create next to files.
    exclude: ["**/node_modules/**", "**/dist/**", "**/._*"],
    setupFiles: ["./test/setup.ts"],
    // These are integration tests against the real Supabase over the network;
    // the free-tier pooler's latency swings from ~70ms to ~500ms+ per query,
    // and the lock tests serialize many queries. Generous on purpose.
    testTimeout: 120_000,
    hookTimeout: 120_000,
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
