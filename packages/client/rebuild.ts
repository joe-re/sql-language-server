import electronRebuild from 'electron-rebuild'

const electronVersion = (process.versions as any).electron
export function rebuild(): Promise<void> {
  return electronRebuild({ buildPath: `${__dirname}/../../../node_modules/sqlite3`, electronVersion, force: true, useCache: false })
}
