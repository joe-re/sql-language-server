import { createFixer, Fixer, FixDescription, applyFixes as srcApplyFixes } from '../src/fixer'

export function applyFixes(sql: string, fixes: ((f: Fixer) => FixDescription | FixDescription[])[]) {
  if (fixes.length === 0) {
    throw new Error("it's not defined fix")
  }
  return srcApplyFixes(sql, fixes.map(v => v(createFixer())).flat())
}