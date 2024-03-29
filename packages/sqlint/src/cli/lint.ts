import chalk from 'chalk'
import { execute, Diagnostic, ErrorLevel } from '../rules'
import { applyFixes, FixDescription } from '../fixer'
import { getFileList, readFile, writeFile } from './utils'
import { loadConfig, RawConfig, convertToConfig } from './loadConfig'

export type LintResult = {
  filepath: string
  diagnostics: Diagnostic[]
  fixedText?: string
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`
}

type FormatType = 'stylish' | 'json'

function formatStylish(result: LintResult[]): string {
  const targetResult = result.filter((v) => v.diagnostics.length > 0)
  let output = '\n',
    errorCount = 0,
    warningCount = 0
  if (targetResult.length === 0) {
    return output
  }
  targetResult.forEach((v) => {
    output += chalk.underline(v.filepath) + '\n'
    v.diagnostics.forEach((v2) => {
      const position = chalk.dim(
        `${v2.location.start.line}:${v2.location.start.offset}`
      )
      const messageType =
        v2.errorLevel === ErrorLevel.Error
          ? chalk.red('error')
          : chalk.yellow('warning')
      const message = v2.message
      const ruleName = chalk.dim(v2.rulename)
      output += `  ${position} ${messageType} ${message} ${ruleName}\n`
      if (v2.errorLevel === ErrorLevel.Error) errorCount++
      else if (v2.errorLevel === ErrorLevel.Warn) warningCount++
    })
  })
  output += '\n'
  const total = errorCount + warningCount
  output += chalk.bold.red(
    [
      `\u2716 ${total} ${pluralize('problem', total)}`,
      `(${errorCount} ${pluralize('error', errorCount)},`,
      `${warningCount} ${pluralize('warning', warningCount)})`,
    ].join(' ')
  )
  return output
}

export function lint(params: {
  path?: string
  formatType: FormatType
  configPath?: string
  outputFile?: string
  text?: string
  fix?: boolean
  configObject?: RawConfig | null
}) {
  const { path, formatType, configPath, outputFile, text, configObject } =
    params
  const files = path ? getFileList(path) : []
  if (files.length === 0 && !text) {
    throw new Error(`No files matching. path: ${path}`)
  }
  const config = configObject
    ? convertToConfig(configObject)
    : loadConfig(configPath || process.cwd())

  let result: LintResult[] = text
    ? [{ filepath: 'text', diagnostics: execute(text, config) }]
    : files
        .map((v) => {
          const diagnostics = execute(readFile(v), config)
          return { filepath: v, diagnostics: diagnostics }
        })
        .flat()

  let output = ''

  if (params.fix) {
    const fixedResult = result.map((v) => {
      const MAX_AUTOFIX_LOOP = 3
      function getFixDescriptions(diagnostics: Diagnostic[]): FixDescription[] {
        return diagnostics.map((v) => v.fix).flat()
      }
      function fix(
        text: string,
        descriptions: FixDescription[],
        loop = MAX_AUTOFIX_LOOP
      ): string {
        if (loop === 0) {
          return text
        }
        const fixed = applyFixes(text, descriptions)
        const nextDiagnostics = execute(fixed, config)
        const newDescriptions = getFixDescriptions(nextDiagnostics)
        if (newDescriptions.length === 0) {
          return fixed
        }
        return fix(fixed, newDescriptions, --loop)
      }
      const fixedText = fix(
        params.text || readFile(v.filepath),
        getFixDescriptions(v.diagnostics)
      )
      const diagnostics = execute(fixedText, config)
      return { filepath: v.filepath, diagnostics, fixedText }
    })
    if (!text) {
      fixedResult.forEach((v) => {
        writeFile(v.filepath, v.fixedText)
      })
    }
    result = fixedResult
  }
  switch (formatType) {
    case 'stylish':
      output = formatStylish(result)
      break
    case 'json':
      output = JSON.stringify(result)
      break
    default:
      throw new Error(`unsupported formatType: ${formatType}`)
  }
  if (outputFile) {
    writeFile(outputFile, output)
  }

  return output
}
