import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync, createReadStream, cpSync } from 'fs';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  worker: {
    format: 'es'
  },
  root: '.',
  publicDir: resolve(__dirname, '../public'),
  server: {
    host: true,
    port: 3000,
    open: false,
    fs: {
      allow: [
        resolve(__dirname, '..')
      ]
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    host: true,
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'esnext'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '/custom': resolve(__dirname, '../custom')
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    {
      name: 'copy-custom-assets',
      apply: 'build',
      enforce: 'post',
      closeBundle() {
        const customSrc = resolve(__dirname, '../custom');
        const customDest = resolve(__dirname, 'dist/custom');
        if (existsSync(customSrc)) {
          cpSync(customSrc, customDest, { recursive: true });
        }
      }
    },
    {
      name: 'vite-external-fallback',
      enforce: 'pre',
      resolveId(id) {
        if (
          id.startsWith('node:') ||
          id === 'node:crypto' ||
          id === 'node:fs' ||
          id === 'node:module' ||
          id.includes('__vite-browser-external') ||
          id.includes('module.no-external')
        ) {
          return '\0virtual-node-fallback:' + id;
        }
      },
      load(id) {
        if (id.startsWith('\0virtual-node-fallback:')) {
          return `
            export const createRequire = () => () => ({ readFileSync: () => new Uint8Array() });
            export const readFileSync = () => new Uint8Array();
            export const webcrypto = globalThis.crypto;
            export const dirname = () => '';
            export const fileURLToPath = () => '';
            export default { createRequire, readFileSync, webcrypto, dirname, fileURLToPath };
          `;
        }
      }
    },
    {
      name: 'static-assets-guard',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const pathname = (req.url || '').split('?')[0].split('#')[0];

          // 1. Handle .wasm requests (read locally)
          if (pathname.endsWith('.wasm')) {
            const genericDiskPath = resolve(__dirname, '../public', pathname.replace(/^\//, ''));
            if (existsSync(genericDiskPath)) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/wasm');
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
              createReadStream(genericDiskPath).pipe(res);
              return;
            }
          }

          // 2. Handle /custom/ static asset requests
          if (pathname.startsWith('/custom/')) {
            const customDiskPath = resolve(__dirname, "..", pathname.replace(/^\//, ""));
            if (existsSync(customDiskPath)) {
              res.statusCode = 200;
              const ext = pathname.split(".").pop().toLowerCase();
              const mimeMap = {
                m4a: "audio/mp4",
                ogg: "audio/ogg",
                wav: "audio/wav",
                mp3: "audio/mpeg",
                json: "application/json",
                png: "image/png",
                glb: "model/gltf-binary",
                gltf: "model/gltf+json",
                wasm: "application/wasm",
                woff: "font/woff",
                woff2: "font/woff2",
                svg: "image/svg+xml",
                ico: "image/x-icon",
                webmanifest: "application/manifest+json"
              };
              res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
              res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
              res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
              createReadStream(customDiskPath).pipe(res);
              return;
            } else {
              res.statusCode = 404;
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.setHeader("X-Asset-Missing", "true");
              res.end(`[Custom Asset 404] The requested custom asset "${pathname}" was not found at: ${customDiskPath}.`);
              return;
            }
          }

          // 3. Intercept missing assets
          if (pathname.startsWith('/assets/') || pathname.startsWith('/images/')) {
            const diskPath = resolve(__dirname, '../public', pathname.replace(/^\//, ''));
            if (!existsSync(diskPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              res.setHeader('X-Asset-Missing', 'true');
              res.end(`[Asset Missing 404] The requested asset "${pathname}" was not found on disk at: ${diskPath}.`);
              return;
            }
          }
          next();
        });
      }
    }
  ]
});
