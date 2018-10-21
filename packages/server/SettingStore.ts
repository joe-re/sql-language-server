import * as fs from 'fs'
import * as log4js from 'log4js';
import * as EventEmitter from 'events'

const logger = log4js.getLogger()

export type Settings = {
  adapter: 'mysql' | 'postgresql',
  host: string | null,
  port: number | null,
  user: string | null,
  database: string | null,
  password: string | null
}

export default class SettingStore extends EventEmitter {
  private state: Settings = {
    adapter: 'mysql',
    host: null,
    port: null,
    user: null,
    database: null,
    password: null
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
    this.state = Object.assign({}, this.state, setting)
    this.emit('change', this.state)
  }
}