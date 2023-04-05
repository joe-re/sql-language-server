# SQL Language Server

[![build-and-test](https://github.com/joe-re/sql-language-server/actions/workflows/test.yaml/badge.svg)](https://github.com/joe-re/sql-language-server/actions/workflows/test.yaml)

The SQL Language Server offers autocompletion, error/warning notifications, and other editor support. It includes a linting feature, an SQL parser, and a Visual Studio Code extension. It supports MySQL, PostgreSQL, and SQLite3 databases.

![completion](https://user-images.githubusercontent.com/4954534/47268897-36b70500-d589-11e8-98b2-65cffdcd60b8.gif)

## Packages

- **sql-language-server**: Autocompletion and notification of warnings and errors [GitHub link](https://github.com/joe-re/sql-language-server/tree/release/packages/server)
- **sqlint**: Linting [GitHub link](https://github.com/joe-re/sql-language-server/tree/release/packages/sqlint)
- **VSC extension**: [Github link](https://github.com/joe-re/sql-language-server/tree/release/packages/client)
- **SQL parser**: [Github link](https://github.com/joe-re/sql-language-server/tree/release/packages/sql-parser)

### Supported DB
- MySQL
- PostgreSQL
- SQLite3

## Installation & How to setup

### Visual Studio Code

Install the [VSC extension](https://marketplace.visualstudio.com/items?itemName=joe-re.sql-language-server).

### Other Editors

```
npm i -g sql-language-server
```

#### Neovim

##### [LanguageClient-neovim](https://github.com/autozimu/LanguageClient-neovim)

Add the following to the `init.vim` file (`.vimrc`):

```vim
let g:LanguageClient_serverCommands = {
    \ 'sql': ['sql-language-server', 'up', '--method', 'stdio'],
    \ }
```

##### [nvim-lsp](https://github.com/neovim/nvim-lspconfig#sqlls)

Run the following command and reference the [nvim-lsp documentation](https://github.com/neovim/nvim-lspconfig#sqlls) for more information.

```vim
:LspInstall sqlls
```

#### Monaco Editor ([monaco-languageclient](https://github.com/TypeFox/monaco-languageclient))

See the [example](https://github.com/joe-re/sql-language-server/blob/master/example/monaco_editor) to use the Monaco Editor to develop sql-language-server.

Follow the [development section](#development) section to check Mocaco Editor working.

## Usage

### CLI

```
$ sql-language-server up [options]        run sql-language-server
```

#### Options

```
  --version      Show version number                                   [boolean]
  --help         Show help                                             [boolean]
  --method, -m  What use to communicate with sql language server
                   [string] [choices: "stdio", "node-ipc"] [default: "node-ipc"]
  --debug, -d    Enable debug logging                 [boolean] [default: false]
```

- Example

```
$ sql-language-server up --method stdio
```

### Configuration

There are two ways to use configuration files.

- Set personal configuration file (`~/.config/sql-language-server/.sqllsrc.json`)
- Set project configuration file on your project root (`${YOUR_PROJECT}/.sqllsrc.json`)
- Use workspace/configuration according to LSP specification

#### Example for personal configuration file

- Examples

```json
{
  "connections": [
    {
      "name": "sql-language-server",
      "adapter": "mysql",
      "host": "localhost",
      "port": 3307,
      "user": "username",
      "password": "password",
      "database": "mysql-development",
      "projectPaths": ["/Users/joe-re/src/sql-language-server"],
      "ssh": {
        "user": "ubuntu",
        "remoteHost": "ec2-xxx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
        "dbHost": "127.0.0.1",
        "port": 3306,
        "identityFile": "~/.ssh/id_rsa",
        "passphrase": "123456"
      }
    },
    {
      "name": "postgres-project",
      "adapter": "postgres",
      "host": "localhost",
      "port": 5432,
      "user": "postgres",
      "password": "pg_pass",
      "database": "pg_test",
      "projectPaths": ["/Users/joe-re/src/postgres_project"]
    },
    {
      "name": "sqlite3-project",
      "adapter": "sqlite3",
      "filename": "/Users/joe-re/src/sql-language-server/packages/server/test.sqlite3",
      "projectPaths": ["/Users/joe-re/src/sqlite2_project"]
    }
  ]
}
```

Please restart sql-language-server process after creating `.sqllsrc.json`.

#### Connection parameters

| Key          | Description                                                                                                               | value                   | required | default                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------- | --------------------------------- |
| name         | Connection name(free-form text)                                                                                           |                         | true     |                                   |
| adapter      | Database type                                                                                                             | "mysql" or "postgres" or "sqlite3" or "bigquery"  | true     |                                   |
| host         | Database host                                                                                                             | string                  | false    |                                   |
| port         | Database port                                                                                                             | string                  | false    | mysql:3306, postgres:5432         |
| user         | Database user                                                                                                             | string                  | false    | mysql:"root", postgres:"postgres" |
| password     | Database password                                                                                                         | string                  | false    |                                   |
| database     | Database name                                                                                                             | string                  | false    |                                   |
| filename     | Database filename(only for sqlite3)                                                                                       | string                  | false    |                                   |
| projectPaths | Project path that you want to apply(if you don't set it configuration will not apply automatically when lsp's started up) | string[]                | false    | []                                |
| ssh          | Settings for port fowarding                                                                                               | \*see below SSH section | false    |                                   |

##### SSH

| Key          | Description                              | value  | required | default                   |
| ------------ | ---------------------------------------- | ------ | -------- | ------------------------- |
| remoteHost   | The host address you want to connect to  | string | true     |                           |
| remotePort   | Port number of the server for ssh        | number | false    | 22                        |
| user         | User name on the server                  | string | false    |                           |
| dbHost       | Database host on the server              | string | false    | 127.0.0.1                 |
| dbPort       | Database port on the server               | number | false    | mysql:3306, postgres:5432 |
| identityFile | Identity file for ssh                    | string | false    | ~/.ssh/config/id_rsa      |
| passphrase   | Passphrase to allow to use identity file | string | false    |                           |

#### Personal configuration file

The personal configuration file is located at `~/.config/sql-language-server/.sqllsrc.json`. When the SQL Language Server starts, it will try to read this file.

#### Project configuration file

The project configuration file is located at `${YOUR_PROJECT_ROOT}/.sqllsrc.json`. This file has the same settings as the personal configuration file, with a few exceptions:

- The connection property is specified directly, rather than as an array.
- The project path does not need to be set. If it is set, it will be ignored.
- The project configuration file is merged with the personal configuration file, if it exists.

Here is an example project configuration file for a PostgreSQL database:
```json
{
  "name": "postgres-project",
  "adapter": "postgres",
  "host": "localhost",
  "port": 5432,
  "user": "postgres",
  "database": "pg_test"
}
```

If you have also set a personal configuration, the project configuration and personal configure will be merged if they have the same name.

Personal configuration example:
```json
{
  "connections": [{
    "name": "postgres-project",
    "password": "password",
    "ssh": {
      "user": "ubuntu",
      "remoteHost": "ec2-xxx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
      "dbHost": "127.0.0.1",
      "port": 5432,
      "identityFile": "~/.ssh/id_rsa",
      "passphrase": "123456"
    }
  }]
}
```

It will merge them as follows:

```json
{
  "name": "postgres-project",
  "adapter": "postgres",
  "host": "localhost",
  "port": 5432,
  "user": "postgres",
  "database": "pg_test",
  "password": "password",
  "ssh": {
    "user": "ubuntu",
    "remoteHost": "ec2-xxx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
    "dbHost": "127.0.0.1",
    "port": 5432,
    "identityFile": "~/.ssh/id_rsa",
    "passphrase": "123456"
  }
}
```

#### Workspace configuration for sql-language-server

##### Parameters of workspace configuration

- `connections`: This parameter is the same as the connections parameter in the personal configuration file. It allows you to specify the connections for your workspace.
- `lint`: This parameter is the same as the configuration of [sqlint](https://github.com/joe-re/sql-language-server/tree/release/packages/sqlint#configuration). It allows you to configure the linting rules for your workspace.


##### Example of workspace configuration

- [coc.nvim](https://github.com/neoclide/coc.nvim)

~/.config/nvim/coc-settings.json
```json
{
  "languageserver": {
    "sql": {
      "command": "sql-language-server",
      "args": ["up", "--method", "stdio"],
      "filetypes": ["sql"],
      "settings": {
        "sqlLanguageServer": {
          "connections": [
            {
              "name": "mysql_project",
              "adapter": "mysql",
              "host": "127.0.0.1",
              "port": 3306,
              "user": "sqlls",
              "password": "sqlls",
              "database": "mysql_db",
              "projectPaths": ["/Users/joe_re/src/MysqlProject"],
              "ssh": {
                "user": "ubuntu",
                "remoteHost": "xxx-xx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
                "dbHost": "127.0.0.1",
                "port": 3306
              }
            }
          ],
          "lint": {
            "rules": {
              "align-column-to-the-first": "error",
              "column-new-line": "error",
              "linebreak-after-clause-keyword": "off",
              "reserved-word-case": ["error", "upper"],
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

- VS Code workspace setting

```json
"settings": {
  "sqlLanguageServer.connections": [
    {
      "name": "mysql_project",
      "adapter": "mysql",
      "host": "127.0.0.1",
      "port": 3306,
      "user": "sqlls",
      "password": "sqlls",
      "database": "mysql_db",
      "projectPaths": ["/Users/joe_re/src/MysqlProject"],
      "ssh": {
        "user": "ubuntu",
        "remoteHost": "xxx-xx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
        "dbHost": "127.0.0.1",
        "port": 3306
      }
    }
  ],
  "sqlLanguageServer.lint": {
    "rules": {
      "align-column-to-the-first": "off",
      "column-new-line": "error",
      "linebreak-after-clause-keyword": "error",
      "reserved-word-case": ["error", "upper"],
      "space-surrounding-operators": "error",
      "where-clause-new-line": "error",
      "align-where-clause-to-the-first": "error",
    }
  }
}
```


#### Inject environment variables

`${env:VARIABLE_NAME}` syntax allows you to replace configuration value with an environment variable.
This is useful if you don't want to store the value in the configuration file.

##### Example

```json
{
  "adapter": "mysql",
  "host": "localhost",
  "port": 3307,
  "user": "username",
  "password": "${env:DB_PASSWORD}",
  "database": "mysql-development",
  "ssh": {
    "user": "ubuntu",
    "remoteHost": "ec2-xxx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
    "dbHost": "127.0.0.1",
    "port": 3306,
    "identityFile": "~/.ssh/id_rsa",
    "passphrase": "${env:SSH_PASSPHRASE}"
  }
}
```

#### Switch database connection

If you have multiple connection entries in your personal config file, you can switch the database connection.

![2020-05-25_15-23-01](https://user-images.githubusercontent.com/4954534/82788937-02f63c80-9e9c-11ea-948d-e27ee0090463.gif)


[VSC extension](https://marketplace.visualstudio.com/items?itemName=joe-re.sql-language-server) provides `Switch database connection` command.

Raw RPC param:
```
method: workspace/executeCommand
command: switchDataBaseConnection
arguments: string(project name)
```


#### SQLite3 Notes

If you get error when you use sqlite3 connection, you may need to rebuild sqlite3 to your environment.

VSC extension provides the command to rebuild it.(Name: `Rebuild SQLite3 Client`)
![image](https://user-images.githubusercontent.com/4954534/85928359-ef952180-b8de-11ea-8cb3-7a9a509cd6d7.png)

If you're using sql-language-server directly, go to the install directory and run `npm rebuild sqlite` to rebuild it.


#### Linting

You can use lint rules provided by [sqlint](https://github.com/joe-re/sql-language-server/tree/release/packages/sqlint) to ensure your SQL code follows best practices and avoid potential errors. Refer to the [sqlint configuraton documentation](https://github.com/joe-re/sql-language-server/tree/release/packages/sqlint#configuration) to learn how to use and configure the linter to match your use case.

![sqlint-on-editor](https://user-images.githubusercontent.com/4954534/83353304-3c3f1880-a384-11ea-8266-4d7048461b56.png)

You can also use sqlint to automatically fix any problems it can identify in your code.

![2020-06-18_08-24-03](https://user-images.githubusercontent.com/4954534/84964358-84a95500-b13e-11ea-9c4f-0b787306bbdf.gif)

Raw RPC param:
```
method: workspace/executeCommand
command: fixAllFixableProblems
arguments: string(document uri)
```

## Contributing to sql-language-server

### Bug Reports and Feature Requests

If you have any questions, problems or suggestions for improvements, feel free to create a new issue on [GitHub Issues](https://github.com/joe-re/sql-language-server/issues). You can also start a discussion there about new rules for SQLint.

### Development

Code contributions are always appreciated, so feel free to fork the repo and submit pull requests.

#### Development environment

You can start developing sql-language-server using Docker Compose. To begin the development process in your Docker container, run the following command:

```sh
$ docker compose up
```

Open `http://localhost:3000` on your browser.

#### Migrating the Database

To migrate the database, follow these steps:

1. Login into development Docker container

```sh
$ docker compose exec assets bash
```

2. Migrate the database

```sh
$ cd example/monaco_editor
$ yarn migrate:postgres # postgres
$ yarn migrate:mysql    # mysql
$ yarn migrate:sqlite   # sqlite3
```
