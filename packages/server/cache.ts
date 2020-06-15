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
    logger.error('--- test ---')
    logger.error(uri)
    logger.error(lintCache)
    this._lintResult.set(uri, lintCache)
  }

  getLintCache(uri: string): LintCache[] {
    return this._lintResult.get(uri) || []
  }

  findLintCacheByRange(uri: string, range: Range): LintCache[] {
    const lintCacheList = this.getLintCache(uri)
    logger.debug(range)
    logger.debug(lintCacheList[0])
    logger.debug(lintCacheList[0].diagnostic.range)
    logger.debug(lintCacheList[0].lint.location)
    return lintCacheList.filter(v => {
      if (v.diagnostic.range.start.line <= range.start.line && v.diagnostic.range.end.line >= range.end.line) {
        return true
      }
      return v.diagnostic.range.start.character <= range.start.character &&
         v.diagnostic.range.end.character >= range.end.character
    })
  }
}

export default new Cache()