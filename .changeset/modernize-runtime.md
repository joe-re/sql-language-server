---
"@joe-re/sql-parser": major
"sqlint": major
"sql-language-server": major
---

Require Node.js 22.13+ (or 24+).

- sql-parser: parsers are generated with peggy 5 (ES2020 output); peggy is no longer a runtime dependency
- sqlint: upgrade ajv to 8 and js-yaml to 4, and replace chalk with `util.styleText`
- sqlint: invalid config errors now report the unexpected property name instead of its value
