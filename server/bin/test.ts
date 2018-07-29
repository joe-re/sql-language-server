import getDatabaseClient from '../database_libs/getDatabaseClient'

// const client = getDatabaseClient({
//   adapter: 'postgresql',
//   host: 'localhost',
//   port: 5432,
//   user: null,
//   database: 'postgres-migration_development',
//   password: null
// })

const client = getDatabaseClient({
  adapter: 'mysql',
  host: 'localhost',
  port: 3306,
  user: "root",
  database: 'mysql-migration_development',
  password: null
})

client.getSchema()
  .then((v) => { console.log(v)})

