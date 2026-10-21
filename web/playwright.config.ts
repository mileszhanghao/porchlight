import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the demo build (the in-browser API), so they need no
// database. `npm run e2e` builds the demo, serves it, and runs these.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173/porchlight/',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: 'VITE_DEMO=true npx vite build --base=/porchlight/ && npx vite preview --base=/porchlight/ --port 4173 --strictPort',
    url: 'http://localhost:4173/porchlight/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
