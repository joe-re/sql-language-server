## sql-language-server monaco-editor example

A browser playground for sql-language-server. [monaco-editor](https://github.com/microsoft/monaco-editor) talks to the language server over a WebSocket through a small LSP bridge (`src/lspClient.ts`) that wires up diagnostics, completion, code actions and the server's commands.

- `server/server.ts` runs sql-language-server in-process for each WebSocket connection on `/lsp`
- `src/` is the browser client, served by Vite on http://localhost:3000 (proxies `/lsp` to the server on port 3001)
- `db/init.sql` is the sample schema used for sqlite, postgres and mysql

### Run locally (sqlite only)

From the repository root:

```sh
$ pnpm install
$ pnpm --filter sql-lsp-monaco-editor-example setup:sqlite   # creates sample.sqlite3
$ pnpm dev
```

Then open http://localhost:3000. `.sqllsrc.json` points the server at `sample.sqlite3`.

### Run with postgres and mysql (Docker)

```sh
$ docker compose up
```

`db/init.sql` is loaded into postgres and mysql when their volumes are created, and `.sqllsrc.personal.json` is installed as the personal config, so you can switch between `sqlite`, `postgres` and `mysql` from the connection selector.

### Run without the Vite dev server

```sh
$ pnpm --filter sql-lsp-monaco-editor-example build
$ PORT=3000 pnpm --filter sql-lsp-monaco-editor-example start
```
