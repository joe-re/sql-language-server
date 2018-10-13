#! /usr/bin/env node
import * as yargs from 'yargs'
import createServer from '../createServer'

const cli: any = yargs
  .usage('SQL Language Server Command Line Interface')
  .help('h')
  .alias('h', 'help')
  .option('m', {
    alias: 'medhod',
    type: 'string',
    default: 'node-ipc',
    choices: ['stdio', 'node-ipc'],
    describe: 'What use to communicate with sql language server'
  })
  .option('d', {
    alias: 'debug',
    type: 'boolean',
    default: false,
    describe: 'Enable debug logging'
  })

// todo: PR to definitly typed to deal with v12
cli.command('up', 'run sql-language-server', () => {
  const connection = createServer()
  connection.console.log('start sql-language-server')
  process.stdin.resume()
}).argv


// Exit the process when stream closes from remote end.
process.stdin.on('close', () => {
  process.exit(0);
});
