import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types'
import { makeTableAlias } from './utils'

export const ICONS = {
  KEYWORD: CompletionItemKind.Text,
  COLUMN: CompletionItemKind.Interface,
  TABLE: CompletionItemKind.Field,
  FUNCTION: CompletionItemKind.Property,
  ALIAS: CompletionItemKind.Variable,
  UTILITY: CompletionItemKind.Event,
}

export class Identifier {
  lastToken: string
  identifier: string
  detail: string
  kind: CompletionItemKind

  constructor(
    lastToken: string,
    identifier: string,
    detail: string,
    kind: CompletionItemKind
  ) {
    this.lastToken = lastToken
    this.identifier = identifier
    this.detail = detail || ''
    this.kind = kind
  }

  matchesLastToken(): boolean {
    if (this.identifier.startsWith(this.lastToken)) {
      // prevent suggesting the lastToken itself, there is nothing to complete in that case
      if (this.identifier !== this.lastToken) {
        return true
      }
    }
    return false
  }

  toCompletionItem(): CompletionItem {
    const idx = this.lastToken.lastIndexOf('.')
    const label = this.identifier.substr(idx + 1)
    let kindName: string
    let tableAlias = ''
    if (this.kind === ICONS.TABLE) {
      let tableName = label
      const i = tableName.lastIndexOf('.')
      if (i > 0) {
        tableName = label.substr(i + 1)
      }
      tableAlias = makeTableAlias(tableName)
      kindName = 'table'
    } else {
      kindName = 'column'
    }

    const item: CompletionItem = {
      label: label,
      detail: `${kindName} ${this.detail}`,
      kind: this.kind,
    }

    if (this.kind == ICONS.TABLE) {
      item.insertText = `${label} AS ${tableAlias}`
    }
    return item
  }
}
