import { createReadStream, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { ORT_CACHE, ORT_RUNTIME_FILES } from './src/domain/speech/whisper/runtime.ts'

const BASE = '/teleo/'
const readJson = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T
const { version } = readJson<{ version: string }>('./package.json')
const ORT_VERSION = readJson<{ version: string }>('./node_modules/onnxruntime-web/package.json').version
const ORT_DIST = fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/', import.meta.url))

/**
 * Content-Security-Policy for the production build (GitHub Pages cannot set
 * headers, so it ships as a <meta> tag). Dev is left alone because Vite's HMR
 * relies on inline scripts. Hugging Face origins are only contacted when the
 * user explicitly downloads an offline Whisper model (v1.1).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

/**
 * Self-hosts the onnxruntime-web WebAssembly runtime of the offline Whisper
 * engine under `ort/<version>/` (no CDN: the CSP allows 'self' scripts only).
 * Dev serves the files from node_modules; the build copies them into dist.
 */
function selfHostedOrtRuntime(): Plugin {
  const prefix = `${BASE}ort/${ORT_VERSION}/`
  const contentType = (file: string) => (file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
  return {
    name: 'teleo:ort-runtime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        const file = path.startsWith(prefix) ? path.slice(prefix.length) : ''
        if (!ORT_RUNTIME_FILES.includes(file)) return next()
        res.setHeader('Content-Type', contentType(file))
        createReadStream(ORT_DIST + file).pipe(res)
      })
    },
    generateBundle() {
      for (const file of ORT_RUNTIME_FILES) {
        this.emitFile({ type: 'asset', fileName: `ort/${ORT_VERSION}/${file}`, source: readFileSync(ORT_DIST + file) })
      }
    },
  }
}

/**
 * onnxruntime-web points at its .wasm with `new URL('ort-wasm-…', import.meta.url)`, which makes
 * Vite emit another 27 MB copy into assets/. Teleo always hands the binary over itself (see
 * `whisper.worker.ts`), so those references are marked `@vite-ignore` (worker build only).
 */
function ignoreBundledOrtWasm(): Plugin {
  return {
    name: 'teleo:ignore-bundled-ort-wasm',
    enforce: 'pre',
    transform(code, id) {
      if (!/onnxruntime-web[\\/]dist[\\/]/.test(id)) return null
      return { code: code.replace(/new URL\((\s*["']ort-wasm-simd-threaded)/g, 'new URL(/* @vite-ignore */$1'), map: null }
    },
  }
}

function contentSecurityPolicy(): Plugin {
  return {
    name: 'teleo:csp',
    apply: 'build',
    // Right after <meta charset> (which must stay first) and before any script or style.
    transformIndexHtml: (html) =>
      html.replace(
        /<meta charset="UTF-8" \/>/,
        (charset) => `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      ),
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  define: { __APP_VERSION__: JSON.stringify(version), __ORT_VERSION__: JSON.stringify(ORT_VERSION) },
  // Module workers (the Whisper worker is created with `type: 'module'`).
  worker: { format: 'es', plugins: () => [ignoreBundledOrtWasm()] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    selfHostedOrtRuntime(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'privacy.html', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        id: BASE,
        name: 'Teleo – modlitwy i afirmacje',
        short_name: 'Teleo',
        description:
          'Wypowiadaj modlitwy i afirmacje na głos – Teleo sprawdza każde zdanie i śledzi Twoją regularność. / Speak prayers and affirmations aloud – Teleo verifies every sentence and tracks your consistency.',
        lang: 'pl',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1f4a3a',
        background_color: '#f7f2e7',
        categories: ['lifestyle', 'education', 'health'],
        icons: [
          { src: 'icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // The Whisper runtime (tens of MB) is never precached; see runtimeCaching below.
        globIgnores: ['**/ort/**'],
        // Room for the Whisper worker chunk (transformers.js + onnxruntime glue), needed offline;
        // anything bigger is a mistake and stays out of the precache.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/privacy\.html$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Versioned paths (ort/<version>/…) make cache-first safe. The model download also
            // stores the runtime in this cache, so Whisper works offline after the first use.
            urlPattern: new RegExp(`${BASE}ort/`.replaceAll('/', '\\/')),
            handler: 'CacheFirst',
            options: { cacheName: ORT_CACHE, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
})
