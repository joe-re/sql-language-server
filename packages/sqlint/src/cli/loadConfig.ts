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
    'where-clause-new-line': { level: ErrorLevel.Error }
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

type RawConfig = {
  rules: {
    [key: string]: string | number | { level: string | number, option: any }
  }
}

function convertToConfig(rawConfig: RawConfig): Config {
  return Object.entries(rawConfig.rules).reduce((p, c) => {
    let level = 0
    if (typeof c[1] === 'number') {
      level = c[1]
    }
    if (typeof c[1] === 'string') {
      switch(c[1]) {
        case 'error': {
          level = 2
          break
        }
        case 'warning': {
          level = 1
          break
        }
        case 'off': {
          level = 0
          break
        }
        default: throw new Error(`unknown error type: ${c[1]}`)
      }
    }
    p.rules[c[0]] = { level }
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
  } else {
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
      config = yaml.safeLoad(fileContent)
      break
    default:
      config = JSON.parse(fileContent)
  }
  validateSchema(config)
  return convertToConfig(config)
}