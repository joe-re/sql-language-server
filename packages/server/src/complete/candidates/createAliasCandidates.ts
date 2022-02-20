import { CompletionItem } from 'vscode-languageserver-types'
import { FromTableNode } from '@joe-re/sql-parser'
import { toCompletionItemForAlias } from '../utils'

export function createAliasCandidates(
  fromNodes: FromTableNode[],
  token: string
): CompletionItem[] {
  return fromNodes
    .map((fromNode) => fromNode.as)
    .filter((aliasName) => aliasName && aliasName.startsWith(token))
    .map((aliasName) => toCompletionItemForAlias(aliasName || ''))
}
