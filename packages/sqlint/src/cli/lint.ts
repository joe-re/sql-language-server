import { getFileList, readFile } from './utils'
import { execute, Diagnostic } from '../rules'
import { loadConfig } from './loadConfig';

type LintResult = {
  filepath: string,
  diagnostics: Diagnostic[]
}
function formatMessage(result: LintResult) {
  return result.diagnostics.map(v =>
    `${v.location.start.line}:${v.location.start.offset} ${v.message}`
  )
}

type FormatType = 'stylish' | 'json'

export function lint (path: string, formatType: FormatType, configDirectoryPath?: string) {
  const files = getFileList(path)
  if (files.length === 0) {
    throw new Error(`No files matching '${path}' were found.`)
  }
  const config = loadConfig(configDirectoryPath || process.cwd())
  const result: LintResult[] = files.map(v => {
    const diaglostics = execute(readFile(v), config)
    return { filepath: v, diagnostics: diaglostics }
  }).flat()
  switch(formatType) {
    case 'stylish': return result.map(v => formatMessage(v)).flat()
    case 'json': return JSON.stringify(result)
    default: throw new Error(`unsupported formatType: ${formatType}`)
  }
}