import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { ConnectionMethod, createServer } from '../src/createServer'

yargs(hideBin(process.argv))
  .usage('SQL Language Server Command Line Interface')
  .command('up', 'run sql-language-server', (v) => {
    return v.option('method', {
      alias: 'm',
      type: 'string',
      default: 'node-ipc',
      choices: ['stdio', 'node-ipc'],
      describe: 'What use to communicate with sql language server'
    }).option('debug', {
      alias: 'd',
      type: 'boolean',
      default: false,
      describe: 'Enable debug logging'
    })
  }, (v) => {
    createServer({ method: v.method as ConnectionMethod, debug: v.debug })
    process.stdin.resume()
  })
  .example('$0 up --method stdio', ': start up sql-language-server - communicate via stdio')
  .demandCommand()
  .help()
  .parse();

process.stdin.on('close', () => {
  process.exit(0);
})
