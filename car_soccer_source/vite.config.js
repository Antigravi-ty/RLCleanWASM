import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync, createReadStream } from 'fs';

export default defineConfig({
  root: '.',
  publicDir: resolve(__dirname, '../public'),
  server: {
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
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'esnext'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  plugins: [
    {
      name: 'vite-external-fallback',
      resolveId(id) {
        if (id.includes('__vite-browser-external') || id.includes('module.no-external')) {
          return '\0' + id;
        }
      },
      load(id) {
        if (id.includes('__vite-browser-external')) {
          return 'export const createRequire = () => () => ({ readFileSync: () => new Uint8Array() }); export default { createRequire };';
        }
        if (id.includes('module.no-external')) {
          return 'export default { init: () => {} };';
        }
      }
    },
    {
      name: 'static-assets-guard',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const pathname = (req.url || '').split('?')[0].split('#')[0];

          // 1. 处理 .wasm 请求 (仅从本地读取)
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

          // 2. 处理 /custom/ 静态资源请求
          if (pathname.startsWith('/custom/')) {
            const customDiskPath = resolve(__dirname, "..", pathname.replace(/^\//, ""));
            if (existsSync(customDiskPath)) {
              res.statusCode = 200;
              const ext = pathname.split(".").pop().toLowerCase();
              const mimeMap = {
                ogg: "audio/ogg",
                wav: "audio/wav",
                mp3: "audio/mpeg",
                json: "application/json",
                png: "image/png",
                wasm: "application/wasm",
                woff: "font/woff",
                woff2: "font/woff2"
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

          // 3. 拦截 missing assets
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