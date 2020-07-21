# SQLint

Lint tool for SQL

![sqlint](https://user-images.githubusercontent.com/4954534/83353270-eff3d880-a383-11ea-8cda-b9e1d74a7e74.gif)


## Installation and Usage

You can install SQLint using npm:

```sh
$ npm install sqlint --save-dev
```

Or using yarn:

```sh
$ yarn add sqlint -D
```

## Editor Support

You can use [sql-language-server](https://github.com/joe-re/sql-language-server) to use SQLint on your editor.

![sqlint-on-editor](https://user-images.githubusercontent.com/4954534/84964358-84a95500-b13e-11ea-9c4f-0b787306bbdf.gif)

## CLI

Example
```
$ sqlint .
```

```
Options:

Options:
  --version     Show version number                                    [boolean]
  -h            Show help                                              [boolean]
  --config, -c  Configuration file path                                 [string]
  --output, -o  Specify file to write report to                         [string]
  --format, -f  Select a output format
                      [string] [choices: "stylish", "json"] [default: "stylish"]
  --stdin       Lint code provide on <STDIN>          [boolean] [default: false]
  --fix         Automatically fix problems            [boolean] [default: false]
```

Use stdin example:
```
$ cat ./test/cli/fixtures/lint/errorSql.sql | sqlint --stdin
```

## Fixing problems

`--fix` option will work to try to fix as many problems as possible.

example:
```
$ sqlint --fix .
```

## Configuration

### Example

```json
{
  "rules": {
    "align-column-to-the-first": "error",
    "column-new-line": "error",
    "linebreak-after-clause-keyword": "error",
    "reserved-word-case": ["error", "upper"],
    "space-surrounding-operators": "error",
    "where-clause-new-line": "error",
    "align-where-clause-to-the-first": "error",
  }
}
```

### Personal config file and project config file

#### Personal confuguration file

Personal configuration file is located on `~/.config/sql-language-server/.sqlintrc.json`.
It'll be applied when it can't find a project configuration file.

#### Project confuguration file

Project configuration file is located on `${YOUR_PROJECT_ROOT}/.sqlintrc.json`.


#### Rule Configuration

Rule shoud be set the ruleID and one of these values:
- "off" or 0
- "warn" or 1
- "error" or 2

Some rules have option that you can modify checking behaviour.
For kind of those rules, you can set Array value that the first element is error level and the second element is option value.

```
"rule-id": ["error", "option"]
```

Option value's type depends on each rules. Please check each rules description to set it.

#### Rules

We're always finding new rules to add.
If you have any prefer rules you want feel free to open a issue to discuss.

##### align-column-to-the-first

Align all columns to the first column on their own line.

Good
```sql
SELECT
  foo.a,
  foo.b
FROM
  foo
```

Bad
```sql
SELECT
  foo.a,
    foo.b
FROM
  foo
```

##### column-new-line

Columns must go on a new line.

Good
```sql
SELECT
  foo.a,
  foo.b
FROM
  foo
```


Bad
```sql
SELECT
  foo.a, foo.b
FROM
  foo
```

##### linebreak-after-clause-keyword

Require linebreak after SELECT, FROM, WHERE keyword.

Good
```sql
SELECT
  foo.aj
FROM
  foo
WHERE
  foo.a > 1
```

Bad
```sql
SELECT foo.aj
FROM foo
WHERE foo.a > 1
```

##### reserved-word-case

Reserved word's case should be unified by upper or lower.

Option: "upper" | "lower" (default: "upper")

Good
```sql
SELECT * FROM foo
```

Bad
```sql
select * FROM foo
```

##### space-surrounding-operators

Spaces around operators.

Option: "always" | "never" (default: "always")

Good("always")
```sql
SELECT *
FROM foo
WHERE foo.a > 1
   OR foo.b >= 2
  AND foo.c = true
   OR foo.d <> false
```

Good("never")
```sql
SELECT *
FROM foo
WHERE foo.a>1
   OR foo.b>=2
  AND foo.c=true
   OR foo.d<>false
```

Bad
```sql
SELECT *
FROM foo
WHERE foo.a > 1
   OR foo.b>=2
  AND foo.c=true
   OR foo.d <> false
```

##### where-clause-new-line

Multiple where clause must go on a new line.

Good
```sql
SELECT foo.a, foo.b
FROM foo
WHERE
  foo.a = 'a'
  AND foo.b = 'b'
```

Bad
```sql
SELECT foo.a, foo.b
FROM foo
WHERE
  foo.a = 'a' AND foo.b = 'b'
```

##### align-where-clause-to-the-first

Where clauses must align to the first clause.

Good
```sql
SELECT foo.a
FROM foo 
WHERE foo.a = 'a' AND foo.b = 'b' AND
      foo.c = 'c' AND
      foo.d = 'd'
```

Bad
```sql
SELECT foo.a
FROM foo 
WHERE foo.a = 'a' AND foo.b = 'b' AND
foo.c = 'c' AND
foo.d = 'd'
```

##### align-where-clause-to-the-first

Where clauses must align to the first clause.

Good
```sql
SELECT foo.a
FROM foo 
WHERE foo.a = 'a' AND foo.b = 'b' AND
      foo.c = 'c' AND
      foo.d = 'd'
```

Bad
```sql
SELECT foo.a
FROM foo 
WHERE foo.a = 'a' AND foo.b = 'b' AND
foo.c = 'c' AND
foo.d = 'd'
```
##### require-as-to-rename-column

As is always required to rename a column name.

Good
```sql
SELECT
  employees.name AS employee_name,
  COUNT(tasks.id) AS assigned_task_count
FROM
  employees LEFT JOIN tasks
    ON employees.id = tasks.id
```

Bad
```sql
SELECT
  employees.name employee_name,
  COUNT(tasks.id) assigned_task_count
FROM
  employees LEFT JOIN tasks
    ON employees.id = tasks.id
```
