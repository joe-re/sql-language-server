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

export function applyFixes(sql: string, fixes: FixDescription[]) {
  if (fixes.length === 0) {
    return null
  }
  const sortedFixes = fixes.concat([]).sort((a, b) =>
    a.range.startOffset - b.range.startOffset || a.range.endOffset - b.range.endOffset
  )
  return sortedFixes.reduce((p, c) => {
    const before = p.slice(0, c.range.startOffset)
    const after = p.slice(c.range.endOffset)
    return before + c.text + after
  }, sql)
}