# SQLLanguageServer

SQL Language Server

![completion](https://user-images.githubusercontent.com/4954534/47268897-36b70500-d589-11e8-98b2-65cffdcd60b8.gif)

## Installation & How to setup

### Visual Studio Code

Install [vsc extension](https://marketplace.visualstudio.com/items?itemName=joe-re.sql-language-server).

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
  "port": 3307,
  "user": "username",
  "password": "password",
  "database": "mysql-development",
  "ssh": {
    "user": "ubuntu",
    "remoteHost": "ec2-xxx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
    "dbHost": "127.0.0.1",
    "port": 3306,
    "identityFile": "~/.ssh/id_rsa",
    "passphrase": "123456"
  }
}
```

Please restart sql-language-server process after create .sqlrc.json.

#### Parameters

| Key      | Description                 | value                   | required | default                           |
| -------- | --------------------------- | ----------------------- | -------- | --------------------------------- |
| adapter  | Database type               | `"mysql" | "postgres"`  | true     |                                   |
| host     | Database host               | string                  | true     |                                   |
| port     | Database port               | string                  | false    | mysql:3306, postgres:5432         |
| user     | Database user               | string                  | true     | mysql:"root", postgres:"postgres" |
| password | Database password           | string                  | false    |                                   |
| database | Database name               | string                  | false    |                                   |
| ssh      | Settings for port fowarding | \*see below SSH section | false    |                                   |

##### SSH

| Key          | Description                              | value  | required | default                   |
| ------------ | ---------------------------------------- | ------ | -------- | ------------------------- |
| remoteHost   | The host address you want to connect to  | string | true     |                           |
| remotePort   | Port number of the server for ssh        | number | false    | 22                        |
| user         | User name on the server                  | string | false    |                           |
| dbHost       | Database host on the server              | string | false    | 127.0.0.1                 |
| dbPort       | Databse port on the server               | number | false    | mysql:3306, postgres:5432 |
| identitiFile | Identity file for ssh                    | string | false    | ~/.ssh/config/id_rsa      |
| passphrase   | Passphrase to allow to use identity file | string | false    |                           |

#### Inject envitonment variables

${ssm:VARIABLE_NAME} syntax allows you to replace configuration value with environt variable.
This is useful when you don't write actual file on configuration file.

##### example

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

### TODO

- [x] SELECT
- [x] INSERT
- [x] UPDATE
- [x] DELETE
- [x] ssh port forwarding
- [ ] Beautify
- [ ] Lint
