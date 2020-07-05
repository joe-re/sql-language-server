import yargs from 'yargs'
import { createServer } from '../createServer'

const cli = yargs
  .usage('SQL Language Server Command Line Interface')
  .command('up', 'run sql-language-server', {
    method: {
      alias: 'm',
      type: 'string',
      default: 'node-ipc',
      choices: ['stdio', 'node-ipc'],
      describe: 'What use to communicate with sql language server'
    },
    'debug': {
      alias: 'd',
      type: 'boolean',
      default: false,
      describe: 'Enable debug logging'
    }
  }, () => {
    createServer()
    process.stdin.resume()
  })
  .example('$0 up --method stdio', ': start up sql-language-server - communicate via stdio')
  .help()
  .argv

if (cli._.length === 0) {
  yargs.showHelp()
}

process.stdin.on('close', () => {
  process.exit(0);
})
