import { FixDescription, applyFixes as srcApplyFixes } from '../src/fixer'

export function applyFixes(sql: string, fixes: FixDescription[]) {
  if (fixes.length === 0) {
    throw new Error("it's not defined fix")
  }
  return srcApplyFixes(sql, fixes)
}