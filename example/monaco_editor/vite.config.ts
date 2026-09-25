import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  // The server looks up .sqllsrc.json in the rootPath sent by the client
  define: {
    __WORKSPACE_ROOT__: JSON.stringify(
      path.dirname(fileURLToPath(import.meta.url))
    ),
  },
  server: {
    port: 3000,
    host: true,
    proxy: { '/lsp': { target: 'ws://localhost:3001', ws: true } },
  },
})
