import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/teleo/`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-pl', use: { ...devices['Pixel 7'], locale: 'pl-PL' } },
    { name: 'desktop-en', use: { ...devices['Desktop Chrome'], locale: 'en-US' } },
    // Safari's engine (iOS/macOS) and Firefox: app logic, layout and storage — speech is faked.
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'], locale: 'pl-PL' } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], locale: 'en-US' } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/teleo/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
