import { Diagnostic as SQLintDiagnostic } from 'sqlint'
import log4js from 'log4js'
import { Diagnostic, Range } from 'vscode-languageserver'

const logger = log4js.getLogger()

export type LintCache = { lint: SQLintDiagnostic; diagnostic: Diagnostic }
class Cache {
  private _lintResult = new Map<string, LintCache[]>()

  setLintCache(uri: string, lintCache: LintCache[]) {
    this._lintResult.set(uri, lintCache)
    logger.debug(this.getLintCache(uri))
  }

  getLintCache(uri: string): LintCache[] {
    return this._lintResult.get(uri) || []
  }

  findLintCacheByRange(uri: string, range: Range): LintCache | null {
    const lintCacheList = this.getLintCache(uri)
    let minDistance = Number.MAX_VALUE
    let result: LintCache | null = null
    lintCacheList
      .filter((v) => {
        if (
          v.diagnostic.range.start.line > range.start.line ||
          v.diagnostic.range.end.line < range.end.line
        ) {
          return false
        }
        if (
          v.diagnostic.range.start.line <= range.start.line &&
          v.diagnostic.range.end.line > range.end.line
        ) {
          return true
        }
        return (
          v.diagnostic.range.start.character <= range.start.character &&
          v.diagnostic.range.end.character >= range.end.character
        )
      })
      .forEach((v) => {
        const distance = Math.abs(
          v.diagnostic.range.start.character - range.start.character
        )
        if (distance < minDistance) {
          minDistance = distance
          result = v
        }
      })
    return result
  }
}

export default new Cache()
