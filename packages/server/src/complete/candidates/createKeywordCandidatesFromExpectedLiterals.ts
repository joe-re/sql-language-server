import { ExpectedLiteralNode } from '@joe-re/sql-parser'
import { CompletionItem } from 'vscode-languageserver-types'
import { toCompletionItemForKeyword } from '../CompletionItemUtils'

// Check if parser expects us to terminate a single quote value or double quoted column name
// SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.
// We don't offer the ', the ", the ` as suggestions
const UNDESIRED_LITERAL = [
  '+',
  '-',
  '*',
  '$',
  ':',
  'COUNT',
  'AVG',
  'SUM',
  'MIN',
  'MAX',
  '`',
  '"',
  "'",
]

export function createKeywordCandidatesFromExpectedLiterals(
  nodes: ExpectedLiteralNode[]
): CompletionItem[] {
  const literals = nodes.map((v) => v.text)
  const uniqueLiterals = [...new Set(literals)]
  return uniqueLiterals
    .filter((v) => !UNDESIRED_LITERAL.includes(v))
    .map((v) => {
      switch (v) {
        case 'ORDER':
          return 'ORDER BY'
        case 'GROUP':
          return 'GROUP BY'
        case 'LEFT':
          return 'LEFT JOIN'
        case 'RIGHT':
          return 'RIGHT JOIN'
        case 'INNER':
          return 'INNER JOIN'
        case 'ALTER':
          if (nodes.find((v) => v.text === 'ADD')) {
            // if 'ADD' is includes on candidates, it should be for "ALTER COLUMN"
            return 'ALTER COLUMN'
          }
          return 'ALTER TABLE'
        default:
          return v
      }
    })
    .map((v) => toCompletionItemForKeyword(v))
}
