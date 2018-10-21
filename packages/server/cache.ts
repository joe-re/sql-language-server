import * as fs from 'fs'

class Cache {
  _cache = new Map<string, string>()
  get(uri: string) {
    let contents = this._cache.get(uri)
    return contents
  }

  set(uri: string, contents: string) {
    this._cache.set(uri, contents)
  }

  setFromUri(uri: string) {
    this.set(uri, fs.readFileSync(uri, 'utf8'))
  }
}

export default new Cache()