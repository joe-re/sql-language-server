import { toCompletionItemForKeyword } from '../CompletionItemUtils'

const CLAUSES: string[] = [
  'SELECT',
  'WHERE',
  'ORDER BY',
  'GROUP BY',
  'LIMIT',
  '--',
  '/*',
  '(',
]

export function createBasicKeywordCandidates() {
  return CLAUSES.map((v) => toCompletionItemForKeyword(v))
}
