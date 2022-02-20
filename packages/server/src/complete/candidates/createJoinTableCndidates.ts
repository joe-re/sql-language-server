import { FromTableNode, ExpectedLiteralNode } from '@joe-re/sql-parser'
import { CompletionItem } from 'vscode-languageserver-types'
import {
  getAliasFromFromTableNode,
  ICONS,
  isTableMatch,
  makeTableAlias,
  makeTableName,
} from '../utils'
import { Table } from '../../database_libs/AbstractClient'

export function createJoinTablesCandidates(
  tables: Table[],
  expected: ExpectedLiteralNode[],
  fromNodes: FromTableNode[],
  token?: string
): CompletionItem[] {
  if (!(fromNodes && fromNodes.length > 0)) {
    return []
  }

  let joinType = ''
  if ('INNER'.startsWith(token || '')) {
    joinType = 'INNER'
  } else if ('LEFT'.startsWith(token || '')) {
    joinType = 'LEFT'
  } else if ('RIGH'.startsWith(token || '')) {
    joinType = 'RIGHT'
  }

  if (!joinType) {
    return []
  }

  const isExpectedJoinKeyWord = !!expected
    .map((v) => v.text)
    .find((v) => v === 'JOIN')

  if (!isExpectedJoinKeyWord) {
    return []
  }

  const fromNode = fromNodes[0]
  const fromAlias = getAliasFromFromTableNode(fromNode)
  const fromTable = tables.find((table) => isTableMatch(fromNode, table))

  return tables
    .filter((table) => table !== fromTable)
    .reduce((c, p) => {
      const newItems = p.columns
        .filter((column) =>
          fromTable?.columns
            .map((col) => col.columnName)
            .includes(column.columnName)
        )
        .map((column) => {
          return {
            tableName: makeTableName(p),
            alias: makeTableAlias(p.tableName),
            columnName: column.columnName,
          }
        })
        .map((match) => {
          const label = `${joinType} JOIN ${match.tableName} AS ${match.alias} ON ${match.alias}.${match.columnName} = ${fromAlias}.${match.columnName}`
          return {
            label: label,
            detail: 'utility',
            kind: ICONS.UTILITY,
          }
        })
      return c.concat(newItems)
    }, [] as CompletionItem[])
}
