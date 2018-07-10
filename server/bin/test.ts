import MysqlClient from '../database_libs/MysqlClient'

const client = new MysqlClient({
  host: 'localhost',
  port: '3306',
  user: 'root',
  database: 'mysql-migration_development',
  password: null
})
client.connect()
client.getSchema().then(() => client.endConnection())

