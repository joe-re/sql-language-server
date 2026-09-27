## @joe-re/sql-parser

A hand-written SQL parser for [sql-language-server](https://github.com/joe-re/sql-language-server).

It is designed for editor use: every node has a precise `location`, whitespace and comments are kept by the tokenizer, and errors report what was expected at the failing position (used for keyword completion).

```js
const { parse, parseAll, parseFromClause, tokenize } = require('@joe-re/sql-parser')

parse('SELECT a FROM t WHERE b = 1') // first statement
parseAll('SELECT 1; SELECT 2') // all statements
parseFromClause('SELECT t. FROM users t WHERE') // the FROM clause of an incomplete SELECT
tokenize('SELECT /* c */ 1') // tokens including whitespace and comments
getCompletionContext('SELECT u. FROM users u', 9) // what can be completed at offset 9
```

`getCompletionContext(sql, offset)` does not require valid SQL. It reports the keywords expected at the cursor, whether a table, a column (expression) or a column name may appear there, the word being typed and its qualifier (`u` in `u.na|`), and the tables visible at the cursor (FROM / JOIN of the innermost query, the target of INSERT / UPDATE / DELETE / ALTER TABLE, and CTEs).

Syntax errors are thrown as `SqlSyntaxError` (`name === 'SyntaxError'`) with `expected`, `found` and `location`.

Supported statements: `SELECT` (with `WITH`, joins, subqueries, `GROUP BY`, `ORDER BY`, `LIMIT`, `UNION`), `INSERT`, `REPLACE`, `UPDATE`, `DELETE`, `CREATE TABLE`, `CREATE INDEX`, `CREATE TYPE`, `ALTER TABLE`, `DROP TABLE`, `DROP VIEW`, `DROP TYPE`.

## License

MIT
