// import MysqlClient from '../database_libs/MysqlClient'
import PostgresClient from '../database_libs/PostgresClient'

// const client = new MysqlClient({
//   host: 'localhost',
//   port: 3306,
//   user: 'root',
//   database: 'mysql-migration_development',
//   password: null
// })
const client = new PostgresClient({
  host: 'localhost',
  port: 5432,
  user: null,
  database: 'postgres-migration_development',
  password: null
})

client.connect()
client.getSchema().then(() => client.disconnect())

