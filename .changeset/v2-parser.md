---
"@joe-re/sql-parser": major
"sqlint": major
"sql-language-server": major
---

`@joe-re/sql-parser` is reimplemented as a hand-written parser in TypeScript.

- `parse`, `parseAll` and `parseFromClause` keep their behavior; existing tests of all packages pass unchanged
- Every node has a `location` (statements, `*`, `IN (...)` lists and `VALUES` included), and ranges no longer include trailing whitespace except `column_list_item` without an alias
- Types are generated from the source (`dist/index.d.ts`), and several shapes were fixed: keywords are always keyword nodes, `IS NOT NULL` has `operator: 'IS NOT'` and a `null` node, aggregate names are upper case, INSERT `columns` is a plain string array, and additional VALUES rows are in `more_rows`
- Newly supported: `||`, `CASE`, `RIGHT` / `FULL` / `CROSS` / `NATURAL JOIN`, `JOIN ... USING`, `LIMIT ... OFFSET`, `INTERSECT` / `EXCEPT`, `::` casts, `INSERT ... SELECT`
- `tokenize()` returns tokens including whitespace and comments
