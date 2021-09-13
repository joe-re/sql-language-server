
## Language Server

Language Server is a special kind of Visual Studio Code extension that powers the editing experience for many programming languages. With Language Servers, you can implement autocomplete, error-checking (diagnostics), jump-to-definition, and many other language features supported in VS Code.

More details found here https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

JupyterLab leverages the VSCode Language Server extentions via this jupyterlab extension
https://github.com/krassowski/jupyterlab-lsp

Naturally `jupyterlab-lsp` supports the python language server.

This page shows the supported language servers
https://jupyterlab-lsp.readthedocs.io/en/latest/Language%20Servers.html

One of these is the `sql-language-srver`
https://github.com/joe-re/sql-language-server

The `sql-language-server` is able to syntax-highlight, lint and code-complete keywords.

Given a database schema it can also auto-complete column and table names. However it can only extract schema from the following database engines. It supports the following `adapter` configuration.

- MySQL
- PostgreSQL
- SQLite3


We have extended `sql-language-server` to support

- Added new `adapter` configuration option named `json`. Which allows for loading schema and function information from json file, rather than having the `sql-language-server` connect to spark to retrieve the information, the idea is to use pyspark from the notebook, produce a json configuration file which the `sql-language-server` monitors for changes and loads.
- Small fixes to allow configuration via the JupyterLab advanced settings
- Nested columns names using multi-part dot seperated paths
- Support for spaces in nested columns names (backtiks each segment)
- Visually distinct icons for `table`, `column`, `alias`, `functions` suggestions
- Added support for code-completion of
	- Functions including descriptions
	- Table alias
	- Table alias followed by dot
	- Partially typed columns including multi-part fields (needed insertText)
    - Map and Array subscripts `map_col['key'].<tab>`, `array_col[0].<tab>`
    - Fully qualified table names `databaseName.schemaName.tableName`
- Added utility to automatically generate all column names for a given table in a SELECT statement
- Added utility to automatically generate join conditions on matching columns from other tables
- When completing tables automatically generate table alias



# JupyterLab Integration

## Install

JupyterLab supports `sql-language-server`. More details here
https://jupyterlab-lsp.readthedocs.io/en/latest/Language%20Servers.html

All that is required is for sql-language-server to be installed.

```bash
$ npm install --save-dev sql-language-server
```

When you create a `%%sql` cell it will trigger the initialization of the `sql-language-server`. You can verify that it starts correctly by looking at the status bar.

![initialized](https://github.com/cccs-jc/sql-language-server/blob/develop/example/jupyterlab/images/initialized-screenshot.png)



# sqlite3

In order to execute `%%sql` cells you need to install the IPython sql magic.

```bash
$ pip3 install ipython-sql
```

In order to code complete your SQL statement you need to configure `sql-language-server` using JupyterLab's Advanced Settings.

> Advanced Settings Editor -> Language Server

Assuming you have an sqlite3 database file at `/tmp/demodb.sqlite` enter the following configuration:
```json
{
    "language_servers": {
        "sql-language-server": {
            "serverSettings": {
                "sqlLanguageServer": {
                    "connections": [
                        {
                            "name": "sqlite-conf",
                            "adapter": "sqlite3",   
                            "filename": "/tmp/demodb.sqlite"
                        }
                    ]
                }
            }
        }
    }
}
```

The code cell now supports syntax highlighting, code completion and execution of SQL statements.

![sqlite](https://github.com/cccs-jc/sql-language-server/blob/develop/example/jupyterlab/images/jupyterlab-sqlite-demo.gif)



# Spark

Sql-language-server now supports a forth `adapter` named `json` which lets you provide your own schema for code completion to the sql-language-server. This is handy for scenarios like Spark where drivers are not easily integrated into a JavaScript process.

The idea is, a user triggers the genration of the schema by calling a function (work in progress). This might be a IPython magic for example

```
%sql-language-server --generateSchema
```

A notebook shows how to export the Spark tables into a json document containing the functions and tables available to spark sql. This code will later be bundled as a library or IPython magic.

[ExportSparkSchema.ipynb](https://github.com/cccs-jc/sql-language-server/blob/develop/example/jupyterlab/ExportSparkSchema.ipynb)


This notebook generates a json file containing functions and table defenitions.

```json
  "functions": [
        {
            "name": "array_contains",
            "description": "Function: array_contains\nClass: org.apache.spark.sql.catalyst.expressions.ArrayContains\nUsage: array_contains(array, value) - Returns true if the array contains the value.\nExtended Usage:\n    Examples:\n      > SELECT array_contains(array(1, 2, 3), 2);\n       true\n  \n    Since: 1.5.0\n"
        },
  ...
  ],
  "tables":[
  		{
			"database": null,
			"tableName": "student",
  			"columns":[
              {
                "columnName": "books",
                "description": "array",
                "metadata": {},
                "type": "array"
              },
              {
                "columnName": "books.title",
                "description": "string",
                "metadata": {},
                "type": "string"
              },
              {
                "columnName": "books.chapters",
                "description": "array",
                "metadata": {},
                "type": "array"
              },
            ]
          }
```

## JupyterLab Configuration

In order to code complete your SQL statement you need to configure `sql-language-server` using JupyterLab's Advanced Settings.

> Advanced Settings Editor -> Language Server

Assuming you have generated your json schema at `/tmp/sparkdb.schema.json` enter the following configuration:

```json
{
    "language_servers": {
        "sql-language-server": {
            "serverSettings": {
                "sqlLanguageServer": {
                    "connections": [
                        {
                            "name": "pyspark-conf",
                            "adapter": "json",   
                            "filename": "/tmp/sparkdb.schema.json"
                        }
                    ]
                }
            }
        }
    }
}
```

In order to execute SQL statements via a cell magic like we did for sqlite3 you need to install the `pyspark_sql` magic.

```bash
$ pip install sparksql-magic
```

You can then alias the `%%sparksql` to be `%%sql`.

Code complete nested columns with subscripts.

![nested](https://github.com/cccs-jc/sql-language-server/blob/develop/example/jupyterlab/images/code-completion-nested.gif)

Code complete spark sql functions with documentation.

![functions](https://github.com/cccs-jc/sql-language-server/blob/develop/example/jupyterlab/images/code-completion-functions.gif)



## Liting

Liting work the same as in VSCode. Simply add a `lint` section to the language server advanced settings.

> Advanced Settings Editor -> Language Server

```
{
    "language_servers": {
        "sql-language-server": {
            "serverSettings": {
                "sqlLanguageServer": {
                    "connections": [
                        {
                            "name": "pyspark-conf",
                            "adapter": "json",   
                            "filename": "/tmp/sparkdb.schema.json"
                        }
                    ],
                        
                    "lint": {
                        "rules": {
                            "align-column-to-the-first": "error",
                            "column-new-line": "error",
                            "linebreak-after-clause-keyword": "off",
                            "reserved-word-case": [
                                "error",
                                "upper"
                            ],
                            "space-surrounding-operators": "error",
                            "where-clause-new-line": "error",
                            "align-where-clause-to-the-first": "error"
                        }
                    }
                }
            }
        }
    }
}
```



## SQL Support in Python Strings

This project [sql-syntax-ipython-string](https://github.com/cccs-jc/sql-syntax-ipython-string) adds syntax highlighting and code completion to SQL within a python string.

![python-string-sql](https://github.com/cccs-jc/sql-language-server/blob/develop/example/jupyterlab/images/python-string-sql.png)
