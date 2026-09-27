---
"@joe-re/sql-parser": minor
"sql-language-server": minor
---

Completion is built on a new `getCompletionContext(sql, offset)` API of the parser instead of syntax errors and `parseFromClause`.

- The parser reports what may appear at the cursor: keywords, and whether a table, an expression or a column name is expected there
- Only the statement and the innermost query at the cursor are used, so tables of other statements no longer leak into completion
- Tables are offered where a table can appear and columns where a column can appear, instead of everywhere
- INSERT / UPDATE / ALTER TABLE column names are taken from the target table instead of all tables, and CTE names and columns are offered
- Completion keeps working when SQL before the cursor is broken, by parsing again from the clause that contains the cursor
