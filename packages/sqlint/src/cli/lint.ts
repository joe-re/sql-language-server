import chalk from 'chalk'
import { getFileList, readFile, writeFile } from './utils'
import { execute, Diagnostic, ErrorLevel } from '../rules'
import { loadConfig } from './loadConfig';

type LintResult = {
  filepath: string,
  diagnostics: Diagnostic[]
}

function pluralize(word: string, count: number) {
    return (count === 1 ? word : `${word}s`);
}

type FormatType = 'stylish' | 'json'

function formatStylish(result: LintResult[]): string {
  let output = '\n', errorCount = 0, warningCount = 0
  if (result.length === 0) {
    return output
  }
  result.forEach(v => {
    output += chalk.underline(v.filepath) + '\n'
    v.diagnostics.forEach(v2 => {
      const position = chalk.dim(`${v2.location.start.line}:${v2.location.start.offset}`)
      const messageType = v2.errorLevel === ErrorLevel.Error ? chalk.red('error') : chalk.yellow('warning')
      const message = v2.message
      const ruleName = chalk.dim(v2.rulename)
      output += `  ${position} ${messageType} ${message} ${ruleName}\n`
      if (v2.errorLevel === ErrorLevel.Error) errorCount++
      else if(v2.errorLevel === ErrorLevel.Warn) warningCount++
    })
  })
  output += '\n'
  const total = errorCount + warningCount
  output += chalk.bold.red(
    [
      `\u2716 ${total} ${pluralize('problem', total)}`,
      `(${errorCount} ${pluralize('error', errorCount)},`,
      `${warningCount} ${pluralize('warning', warningCount)})`
    ].join(' ')
  )
  return output
}

export function lint (
  path: string,
  formatType: FormatType,
  configDirectoryPath?: string,
  outputFile?: string,
) {
  const files = getFileList(path)
  if (files.length === 0) {
    throw new Error(`No files matching '${path}' were found.`)
  }
  const config = loadConfig(configDirectoryPath || process.cwd())
  const result: LintResult[] = files.map(v => {
    const diaglostics = execute(readFile(v), config)
    return { filepath: v, diagnostics: diaglostics }
  }).flat()
  let output = ''
  switch(formatType) {
    case 'stylish': output = formatStylish(result); break
    case 'json': output = JSON.stringify(result); break
    default: throw new Error(`unsupported formatType: ${formatType}`)
  }
  if (outputFile) {
    writeFile(outputFile, output)
  }
  return output
}