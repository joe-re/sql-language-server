import { Config, ErrorLevel } from '../rules'
import { fileExists, readFile, directoryExists } from './utils'
import * as yaml from 'js-yaml'
import Ajv from 'ajv'
import schemaConf from '../../schema.conf'
import { extname } from 'path'

const configFiles = [
  { name: '.sqlintrc.json' },
  { name: '.sqlintrc.yaml' },
  { name: '.sqlintrc.yml' },
]

const defaultConfig: Config = {
  rules: {
    'align-column-to-the-first': { level: ErrorLevel.Error },
    'column-new-line': { level: ErrorLevel.Error },
    'linebreak-after-clause-keyword': { level: ErrorLevel.Error },
    'reserved-word-case': { level: ErrorLevel.Error, option: 'upper' },
    'space-surrounding-operators': { level: ErrorLevel.Error },
    'where-clause-new-line': { level: ErrorLevel.Error },
    'align-where-clause-to-the-first': { level: ErrorLevel.Error },
    'require-as-to-rename-column': { level: ErrorLevel.Error }
  }
}

function formatErrors(errors: Ajv.ErrorObject[]) {
  return errors.map(error => {
      if (error.keyword === "additionalProperties") {
          return `Unexpected property "${error.data.invalidProp}"`;
      }
  }).map(message => `\t- ${message}.\n`).join("");
}

function validateSchema(config: Object) {
  const ajv = new Ajv({ verbose: true, schemaId: 'auto', missingRefs: 'ignore' })
  const validate = ajv.compile(schemaConf)
  if (!validate(config)) {
    throw new Error(`SQLint configuration is invalid:\n${formatErrors(validate.errors || [])}`)
  }
  return true
}

export type RawConfig = {
  rules: {
    [key: string]: string | number | { level: string | number, option: any }
  }
}

export function convertToConfig(rawConfig: RawConfig): Config {
  return Object.entries(rawConfig.rules).reduce((p, c) => {
    let level = 0
    let option = null
    const getLevel = (v: any) => {
      if (typeof v === 'number') {
        return v
      }
      if (typeof v === 'string') {
        switch(v) {
          case 'error': return 2
          case 'warning': return 1
          case 'off': return 0
          default: throw new Error(`unknown error type: ${c[1]}`)
        }
      }
      return 0
    }
    if (Array.isArray(c[1])) {
      level = getLevel(c[1][0])
      option = c[1][1]
    } else {
      level = getLevel(c[1])
    }
    p.rules[c[0]] = { level, option }
    return p
  }, { rules: {} } as Config)
}

export function loadConfig(directoryOrFile: string): Config {
  let filePath = '';
  if (fileExists(directoryOrFile)) {
    filePath = directoryOrFile
  } else if (directoryExists(directoryOrFile)) {
    const file = configFiles.find(v => fileExists(`${directoryOrFile}/${v.name}`))
    if (file) filePath = `${directoryOrFile}/${file.name}`
  }
  if (!filePath) {
    // try to lookup personal config file
    const file = configFiles.find(v =>
      fileExists(`${process.env.HOME}/.config/sql-language-server/${v.name}`)
    )
    if (file) filePath = `${process.env.HOME}/.config/sql-language-server/${file.name}`
  }
  if (!filePath) {
    return defaultConfig
  }
  const fileContent = readFile(filePath)
  let config: RawConfig;
  switch(extname(filePath)) {
    case '.json':
      config = JSON.parse(fileContent)
      break
    case '.yaml':
    case '.yml':
      config = yaml.safeLoad(fileContent) as any
      break
    default:
      config = JSON.parse(fileContent)
  }
  validateSchema(config)
  return convertToConfig(config)
}