import { exec } from 'child_process'

const run = function (cmd): Promise<void> {
  const child = exec(cmd, function (error, stdout, stderr) {
    if (stderr !== null) {
      console.log('' + stderr)
    }
    if (stdout !== null) {
      console.log('' + stdout)
    }
    if (error !== null) {
      console.log('' + error)
    }
  })
  return new Promise((resolve, reject) => {
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(signal))
    })
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const electronVersion = (process.versions as any).electron

export function rebuild(): Promise<void> {
  const command = `
     cd ${__dirname}/../../server &&
     npm install sqlite3 electron-rebuild &&
     ./node_modules/.bin/electron-rebuild node_modules/sqlite3 -v ${electronVersion}
  `
  return run(command)
}
