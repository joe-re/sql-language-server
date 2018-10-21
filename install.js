const exec = require('child_process').exec;

const executeCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout)
    })
  })
}
let promises = Promise.resolve()
if (process.env.npm_execpath.indexOf('yarn') === -1) {
  console.log('using npm for installation.')
  promises = Promise.all([
    executeCommand('cd packages/client && npm install && node ./node_modules/vscode/bin/install'),
    executeCommand('cd packages/server && npm install')
  ])
} else {
  console.log('using yarn for installation.')
  promises = Promise.all([
    executeCommand('node ./node_modules/vscode/bin/install'),
  ])
}

promises.then(logs => {
  logs.forEach(v => console.log(v))
  console.log('success install.')
})
