import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types'
import { DbFunction } from '../database_libs/AbstractClient'

export const ICONS = {
  KEYWORD: CompletionItemKind.Text,
  COLUMN: CompletionItemKind.Interface,
  TABLE: CompletionItemKind.Field,
  FUNCTION: CompletionItemKind.Property,
  ALIAS: CompletionItemKind.Variable,
  UTILITY: CompletionItemKind.Event,
}

export function toCompletionItemForFunction(f: DbFunction): CompletionItem {
  const item: CompletionItem = {
    label: f.name,
    detail: 'function',
    kind: ICONS.FUNCTION,
    documentation: f.description,
  }
  return item
}

export function toCompletionItemForAlias(alias: string): CompletionItem {
  const item: CompletionItem = {
    label: alias,
    detail: 'alias',
    kind: ICONS.ALIAS,
  }
  return item
}

export function toCompletionItemForKeyword(name: string): CompletionItem {
  const item: CompletionItem = {
    label: name,
    kind: ICONS.KEYWORD,
    detail: 'keyword',
  }
  return item
}
