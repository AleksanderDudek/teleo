/** Restarts the app so every in-memory state (language, theme, stores) follows restored or deleted data. */
export const restartApp = (delayMs = 600) => window.setTimeout(() => window.location.replace(import.meta.env.BASE_URL), delayMs)
