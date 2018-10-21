# SQLLanguageServer

SQL Language Server

![completion](https://user-images.githubusercontent.com/4954534/47268897-36b70500-d589-11e8-98b2-65cffdcd60b8.gif)

## Instllation & How to setup

### Visual Studio Code

Install vsc extension.

### Other Editors

```
npm i -g sql-language-server
```

#### Neovim example([LanguageClient-neovim](https://github.com/autozimu/LanguageClient-neovim))

- .vimrc

```
let g:LanguageClient_serverCommands = {
    \ 'sql': ['sql-language-server', 'up', '--method', 'stdio'],
    \ }
```

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

### Connect to database

#### Create .sqllsrc.json on your project root

- Examples

```json
{
  "adapter": "mysql",
  "host": "localhost",
  "port": 3306,
  "user": "username",
  "password": "password",
  "database": "mysql-development"
}
```

- Details
  - adapter: "mysql" | "postgres"
  - host: string
  - port: number
  - user: string
  - password: string
  - database: string

Please restart sql-language-server process after create .sqlrc.json.

### TODO

Now only support select statement, we are planning to support other statements in the furure.
