const path = require('path')

module.exports = {
  "postgres": {
    "username": "sqlls",
    "password": "sqlls",
    "database": "postgres_db",
    "host": "postgres",
    "dialect": "postgres"
  },
  "mysql": {
    "username": "sqlls",
    "password": "sqlls",
    "database": "mysql_db",
    "host": "mysql",
    "dialect": "mysql"
  },
  "sqlite": {
    "storage": path.join(__dirname, '..', 'sqlite_db.sqlite'),
    "dialect": "sqlite"
  }
}
