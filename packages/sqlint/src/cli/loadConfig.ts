import { Config, ErrorLevel } from '../rules'
import { fileExists, readFile } from './utils'
import * as yaml from 'js-yaml'
import * as Ajv from 'ajv'
import schemaConf from '../../schema.conf'

enum FileType {
  JSON = 'json',
  YAML = 'yaml'
}
const configFiles = [
  { name: '.sqlintrc.json', type: FileType.JSON },
  { name: '.sqlintrc.yaml', type: FileType.YAML },
  { name: '.sqlintrc.yml', type: FileType.YAML },
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
    throw new Error(`SQLint configuration is invalid:\n${formatErrors(validate.errors)}`)
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

export function loadConfig(directory: string): Config {
  const file = configFiles.find(v => fileExists(`${directory}/${v.name}`))
  if (!file) {
    return defaultConfig
  }
  const fileContent = readFile(`${directory}/${file.name}`)
  let config: RawConfig;
  switch(file.type) {
    case FileType.JSON: config = JSON.parse(fileContent); break
    case FileType.YAML: config = yaml.safeLoad(fileContent); break
  }
  validateSchema(config)
  return convertToConfig(config)
}