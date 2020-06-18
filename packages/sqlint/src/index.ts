import { lint, LintResult } from './cli/lint'
import { ErrorLevel, Diagnostic } from './rules/index'
import { applyFixes } from './fixer'

export { lint, LintResult, ErrorLevel, Diagnostic, applyFixes }