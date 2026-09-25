# Changesets

Run `pnpm changeset` to record a change to `@joe-re/sql-parser`, `sqlint` or `sql-language-server`.
These three packages are versioned together. Run `pnpm release:version` to bump versions and
`pnpm release:publish` to build and publish them to npm.

The VS Code extension (root `package.json`) is not managed by changesets; publish it with `pnpm vscode:publish`.
