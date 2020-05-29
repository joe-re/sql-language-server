const yargs = require('yargs')
const commands = require('../dist/src/cli')

const cli = yargs
  .usage('SQLint: Lint tool for SQL')
  .command('lint [options] [file]', 'lint sql files', {
    config: {
      alias: 'c',
      type: 'string',
      default: '.sqlintrc.json',
      describe: 'Configuration file path'
    },
    'debug': {
      alias: 'd',
      type: 'boolean',
      default: false,
      describe: 'Enable debug logging'
    },
    'output': {
      alias: 'o',
      type: 'string',
      describe: 'Specify file to write report to'
    },
    'format': {
      alias: 'f',
      type: 'string',
      choices: ['stylish', 'json'],
      describe: 'Select a output format',
      default: 'stylish'
    }
  }, () => {
    const result = commands.lint(yargs.argv._[1], yargs.argv.format, yargs.argv.config, yargs.argv.output)
    if (!yargs.argv.output) {
      console.log(result)
    }
  })
  .example('$0 lint ./sql/a.sql', 'lint the specified sql file')
  .help('h')
  .argv

if (cli._.length === 0) {
  yargs.showHelp()
}

process.stdin.on('close', () => {
  process.exit(0);
})
