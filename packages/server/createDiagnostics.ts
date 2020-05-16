import { parse } from '@joe-re/node-sql-parser'
import * as log4js from 'log4js';
import { PublishDiagnosticsParams, DiagnosticSeverity } from 'vscode-languageserver'

const logger = log4js.getLogger()

export default function createDiagnostics(uri: string, sql: string): PublishDiagnosticsParams {
  logger.debug(`createDiagnostics`)
  let diagnostics = []
  try {
    const ast = parse(sql)
    logger.debug(`ast: ${JSON.stringify(ast)}`)
  } catch (e) {
    logger.debug('parse error')
    logger.debug(e)
    if (e.name !== 'SyntaxError') {
      throw e
    }
    diagnostics.push({
      range: {
        start: { line: e.location.start.line - 1, character: e.location.start.column },
        end: { line: e.location.end.line - 1, character: e.location.end.column }
      },
      message: e.message,
      severity: DiagnosticSeverity.Error,
      // code: number | string,
      source: 'sql',
      relatedInformation: []
    })
  }
  logger.debug(JSON.stringify(diagnostics))
  return { uri: uri, diagnostics }
}
