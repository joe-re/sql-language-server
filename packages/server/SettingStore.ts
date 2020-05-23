import * as fs from 'fs'
import log4js from 'log4js';
import EventEmitter from 'events'

const logger = log4js.getLogger()

export type SSHConfig = {
  remoteHost: string
  remotePort?: number
  dbHost?: string
  dbPort?: number
  user?: string
  passphrase?: string
  identityFile?: string
}
export type Settings = {
  name: string | null,
  adapter: 'mysql' | 'postgresql' | null,
  host: string | null,
  port: number | null,
  user: string | null,
  database: string | null,
  password: string | null,
  projectPaths: string[],
  ssh: SSHConfig | null
}

type PersonalConfig = {
  connections: Settings[]
}

function fileExists(path: string) {
  try {
    return fs.statSync(path).isFile()
  } catch (error) {
    if (error && error.code === "ENOENT") {
        return false;
    }
    throw error;
  }
}

function readFile(filePath: string) {
  return fs.readFileSync(filePath, "utf8").replace(/^\ufeff/u, "");
}

export default class SettingStore extends EventEmitter {
  private state: Settings = {
    name: null,
    adapter: null,
    host: null,
    port: null,
    user: null,
    database: null,
    password: null,
    ssh: null,
    projectPaths: []
  }
  private static instance: SettingStore;

  private constructor() { super() }

  static getInstance() {
    if (SettingStore.instance) {
      return SettingStore.instance
    }
    SettingStore.instance = new SettingStore()
    return SettingStore.instance
  }

  getSetting() {
    return Object.assign({}, this.state)
  }

  async setSettingFromFile(personalConfigPath: string, projectConfigPath: string, projectPath: string): Promise<Settings | null> {
    let personalConfig = { connections: [] } as PersonalConfig, projectConfig = {} as Settings
    if (fileExists(personalConfigPath)) {
      personalConfig = JSON.parse(readFile(personalConfigPath))
    } else {
      logger.debug(`There isn't personal config file. ${personalConfigPath}`)
    }
    if (fileExists(projectConfigPath)) {
      projectConfig = JSON.parse(readFile(projectConfigPath))
    } else {
      logger.debug(`There isn't project config file., ${projectConfigPath}`)
    }
    const extractedPersonalConfig = projectConfig.name
      ? personalConfig.connections.find((v: Settings) => v.name === projectConfig.name)
      : personalConfig.connections.find((v: Settings) => v.projectPaths?.includes(projectPath))
    if (!extractedPersonalConfig) {
      logger.debug(`Failed to extract personal config, { path: ${projectPath}, projectName: ${projectConfig.name} }`)
    }

    const sshConfig = { ...extractedPersonalConfig?.ssh || {}, ...projectConfig?.ssh || {} } as SSHConfig
    const config = { ...extractedPersonalConfig, ...projectConfig }
    config.ssh = sshConfig
    logger.debug(`Set config: ${JSON.stringify(config)}`)
    this.setSetting(config)
    return this.getSetting()
  }

  setSetting(setting: Partial<Settings>) {
    const replaceEnv = (v: { [key: string]: any }) => {
      for (const k in v) {
        if (v[k] && typeof v[k] === 'object') {
          replaceEnv(v[k])
        } else if (typeof v[k] === 'string') {
          const matched = (v[k] as string).match(/\${env:(.*?)}/)
          if (matched) {
            v[k] = (v[k] as string).replace(`\${env:${matched[1]}}`, process.env[matched[1]] || '')
          }
        }
      }
    }
    const newSetting = Object.assign({}, setting)
    newSetting.ssh = newSetting.ssh ? Object.assign({}, newSetting.ssh) : null
    replaceEnv(newSetting)
    this.state = Object.assign({}, this.state, newSetting)
    logger.debug('setting store, emit "change"')
    this.emit('change', this.state)
  }
}