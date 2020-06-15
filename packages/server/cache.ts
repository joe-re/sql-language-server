import * as fs from 'fs'
import { Diagnostic as SQLintDiagnostic } from 'sqlint'
import log4js from 'log4js'
import { Diagnostic, Range } from 'vscode-languageserver'

const logger = log4js.getLogger()

export type LintCache = { lint: SQLintDiagnostic, diagnostic: Diagnostic }
class Cache {
  private _cache = new Map<string, string>()
  private _lintResult = new Map<string, LintCache[]>()
  get(uri: string) {
    let contents = this._cache.get(uri)
    return contents
  }

  set(uri: string, contents: string) {
    this._cache.set(uri, contents)
  }

  setFromUri(uri: string) {
    this.set(uri, fs.readFileSync(uri, 'utf8'))
  }

  setLintCache(uri: string, lintCache: LintCache[]) {
    this._lintResult.set(uri, lintCache)
    logger.debug(this.getLintCache(uri))
  }

  getLintCache(uri: string): LintCache[] {
    return this._lintResult.get(uri) || []
  }

  findLintCacheByRange(uri: string, range: Range): LintCache[] {
    const lintCacheList = this.getLintCache(uri)
    return lintCacheList.filter(v => {
      if (v.diagnostic.range.start.line > range.start.line || v.diagnostic.range.end.line < range.end.line) {
        return false
      }
      if (v.diagnostic.range.start.line <= range.start.line && v.diagnostic.range.end.line > range.end.line) {
        return true
      }
      return v.diagnostic.range.start.character <= range.start.character &&
         v.diagnostic.range.end.character >= range.end.character
    })
  }
}

export default new Cache()