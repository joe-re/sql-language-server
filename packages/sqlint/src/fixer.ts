import { Context } from "./rules"

export type FixDescription = {
  range: { startOffset: number, endOffset: number }
  text: string
}

export type Fixer = {
  insertTextBefore(offset: number, text: string): FixDescription
}

export function createFixer(context: Context): Fixer {
  return {
    insertTextBefore(offset, text) {
      const newText = context.getSQL({
         start: { offset: offset - text.length },
         end: { offset: offset }
      }) + text
      return {
        range: { startOffset: offset - text.length, endOffset: offset },
        text: newText
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