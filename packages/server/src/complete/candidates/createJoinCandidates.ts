import { CompletionItem } from 'vscode-languageserver-types'
import { SelectStatement } from '@joe-re/sql-parser'
import {
  getNearestFromTableFromPos,
  toCompletionItemForKeyword,
} from '../utils'
import { Table } from '../../database_libs/AbstractClient'
import { createTableCandidates } from './createTableCandidates'

type Pos = { line: number; column: number }

export function createJoinCondidates(
  ast: SelectStatement,
  tables: Table[],
  pos: Pos,
  token: string
): CompletionItem[] {
  if (!Array.isArray(ast.from?.tables)) {
    return []
  }
  const result: CompletionItem[] = []
  const fromTable = getNearestFromTableFromPos(ast.from?.tables || [], pos)
  if (fromTable && fromTable.type === 'table') {
    result.push(...createTableCandidates(tables, token))
    result.push(toCompletionItemForKeyword('INNER JOIN'))
    result.push(toCompletionItemForKeyword('LEFT JOIN'))
    result.push(toCompletionItemForKeyword('ON'))
  }
  return result
}
