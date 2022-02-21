import { FromTableNode } from '@joe-re/sql-parser'
import { Table } from '../database_libs/AbstractClient'
import { Pos } from './complete'

export function makeTableAlias(tableName: string): string {
  if (tableName.length > 3) {
    return tableName.substring(0, 3)
  }
  return tableName
}

export function getRidOfAfterPosString(sql: string, pos: Pos): string {
  return sql
    .split('\n')
    .filter((_v, idx) => pos.line >= idx)
    .map((v, idx) => (idx === pos.line ? v.slice(0, pos.column) : v))
    .join('\n')
}

// Gets the last token from the given string considering that tokens can contain dots.
export function getLastToken(sql: string): string {
  const match = sql.match(/^(?:.|\s)*[^A-z0-9\\.:'](.*?)$/)
  if (match) {
    let prevToken = ''
    let currentToken = match[1]
    while (currentToken != prevToken) {
      prevToken = currentToken
      currentToken = prevToken.replace(/\[.*?\]/, '')
    }
    return currentToken
  }
  return sql
}

export function makeTableName(table: Table): string {
  if (table.catalog) {
    return table.catalog + '.' + table.database + '.' + table.tableName
  } else if (table.database) {
    return table.database + '.' + table.tableName
  }
  return table.tableName
}

export function getAliasFromFromTableNode(node: FromTableNode): string {
  if (node.as) {
    return node.as
  }
  if (node.type === 'table') {
    return node.table
  }
  return ''
}

export function makeColumnName(alias: string, columnName: string) {
  return alias ? alias + '.' + columnName : columnName
}
