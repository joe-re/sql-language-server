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
  adapter: 'mysql' | 'postgresql',
  host: string | null,
  port: number | null,
  user: string | null,
  database: string | null,
  password: string | null,
  ssh: SSHConfig | null
}

export default class SettingStore extends EventEmitter {
  private state: Settings = {
    adapter: 'mysql',
    host: null,
    port: null,
    user: null,
    database: null,
    password: null,
    ssh: null
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

  setSettingFromFile(path: string) {
    return new Promise((resolve, reject) => {
      fs.stat(path, (err, _stat) => {
        if (err) {
          if (err.code && err.code === 'ENOENT') {
             logger.debug("there isn't config file.")
             resolve()
             return
          }
          logger.error(err.message)
          reject(err)
          return
        }
        fs.readFile(path, { encoding: 'utf8' }, (err, data) => {
          if (err) {
            logger.error(err.message)
            reject(err)
            return
          }
          this.setSetting(JSON.parse(data))
          logger.debug(`read settings from ${path}`)
          logger.debug(JSON.stringify(this.getSetting()))
          resolve(this.getSetting())
          return
        })
      })
    })
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
    this.emit('change', this.state)
  }
}