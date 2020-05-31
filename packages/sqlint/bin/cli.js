const yargs = require('yargs')
const commands = require('../dist/src/cli')

function readStdin() {
  return new Promise((resolve, reject) => {
    let content = ''
    let chunk = ''
    process.stdin.setEncoding('utf8').on('readable', () => {
      while((chunk = process.stdin.read()) !== null) {
        content += chunk
      }
    })
    .on('end', () => resolve(content))
    .on('error', reject)
  })
}

const cli = yargs
  .usage('SQLint: Lint tool for SQL')
  .command('lint [options] [file]', 'lint sql files', {
    config: {
      alias: 'c',
      type: 'string',
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
    },
    'stdin': {
      type: 'boolean',
      describe: 'Lint code provide on <STDIN>',
      default: false
    }
  }, async () => {
    const result = commands.lint({
      path: yargs.argv._[1],
      formatType: yargs.argv.format,
      configPath: yargs.argv.config,
      outputFile: yargs.argv.output,
      text: yargs.argv.stdin ? await readStdin() : null
    })
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
