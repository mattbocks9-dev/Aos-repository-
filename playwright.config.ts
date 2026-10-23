import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PW_CHROMIUM ?? undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173', launchOptions: { executablePath } },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'], browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, browserName: 'chromium' } },
  ],
});
