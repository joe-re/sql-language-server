export type FixDescription = {
  range: { startOffset: number, endOffset: number }
  text: string
}

export type Fixer = {
  insertText(offset: number, text: string): FixDescription
  replaceText(startOffset: number, endOffset: number, text: string): FixDescription
}

export function createFixer(): Fixer {
  return {
    insertText(offset, text) {
      return {
        range: { startOffset: offset, endOffset: offset },
        text: text
      }
    },
    replaceText(startOffset, endOffset, text) {
      return {
        range: { startOffset, endOffset },
        text
      }
    }
  }
}

export function applyFixes(sql: string, fixes: FixDescription | FixDescription[]) {
  const _fixes = Array.isArray(fixes) ? fixes : [fixes]
  if (_fixes.length === 0) {
    return sql
  }
  const sortedFixes = _fixes.concat([]).sort((a, b) =>
    b.range.startOffset - a.range.startOffset || b.range.endOffset - a.range.endOffset
  )
  return sortedFixes.reduce((p, c) => {
    const before = p.slice(0, c.range.startOffset)
    const after = p.slice(c.range.endOffset)
    return before + c.text + after
  }, sql)
}