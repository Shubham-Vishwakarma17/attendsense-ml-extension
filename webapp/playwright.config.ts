import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  outputDir: "node_modules/.cache/playwright-test-results",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5187 --strictPort",
    env: { VITE_DEMO_MODE: "true" },
    url: "http://127.0.0.1:5187/login",
    reuseExistingServer: false,
    timeout: 30_000
  },
  use: {
    baseURL: "http://127.0.0.1:5187",
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
