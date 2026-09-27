---
"sql-language-server": patch
---

- Switching the database connection no longer keeps fields of the previous connection (e.g. `database`, `host`); the new connection replaces the whole setting.
- The project root is taken from `workspaceFolders` / `rootUri` (falling back to the deprecated `rootPath`), so clients that do not send `rootPath` now load `.sqllsrc.json` from the project.
- Connections given through the `sqlLanguageServer.connections` workspace setting are now matched by `projectPaths` instead of always using the first one.
