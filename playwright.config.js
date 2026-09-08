import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5176',
    viewport: { width: 900, height: 800 },
  },
  webServer: {
    command: 'npx vite --port 5176 --strictPort',
    url: 'http://localhost:5176',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});