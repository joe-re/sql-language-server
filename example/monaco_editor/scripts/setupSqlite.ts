import { readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

// Creates sample.sqlite3 (used by .sqllsrc.json) from db/init.sql
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, 'sample.sqlite3')
rmSync(file, { force: true })
const db = new DatabaseSync(file)
db.exec(readFileSync(path.join(root, 'db', 'init.sql'), 'utf8'))
db.close()
console.log(`created ${file}`)
