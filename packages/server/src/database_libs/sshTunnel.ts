import { readFileSync } from 'fs'
import { AddressInfo, createServer, Server } from 'net'
import { homedir } from 'os'
import path from 'path'
import log4js from 'log4js'
import { Client } from 'ssh2'
import { SSHConfig } from '../SettingStore'

const logger = log4js.getLogger()

export type SshTunnel = {
  localPort: number
  close(): void
}

export function expandHome(filePath: string): string {
  if (filePath === '~' || filePath.startsWith('~/')) {
    return path.join(homedir(), filePath.slice(1))
  }
  return filePath
}

function connectSsh(config: SSHConfig): Promise<Client> {
  const client = new Client()
  return new Promise((resolve, reject) => {
    client
      .once('ready', () => resolve(client))
      .once('error', reject)
      .connect({
        host: config.remoteHost,
        port: config.remotePort || 22,
        username: config.user,
        privateKey: readFileSync(
          expandHome(config.identityFile || '~/.ssh/id_rsa')
        ),
        passphrase: config.passphrase || undefined,
      })
  })
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve((server.address() as AddressInfo).port)
    })
  })
}

/**
 * Forward 127.0.0.1:localPort to dbHost:dbPort through the ssh server.
 * Pass localPort 0 to pick a free port.
 */
export async function openSshTunnel(
  config: SSHConfig,
  localPort: number,
  dbPort: number
): Promise<SshTunnel> {
  const ssh = await connectSsh(config)
  const dbHost = config.dbHost || '127.0.0.1'
  const server = createServer((socket) => {
    ssh.forwardOut(
      '127.0.0.1',
      socket.remotePort || 0,
      dbHost,
      dbPort,
      (err, stream) => {
        if (err) {
          logger.error('Failed to forward ssh tunnel', err)
          socket.destroy()
          return
        }
        socket.pipe(stream).pipe(socket)
      }
    )
  })
  try {
    const port = await listen(server, localPort)
    logger.debug(`ssh tunnel: 127.0.0.1:${port} -> ${dbHost}:${dbPort}`)
    return {
      localPort: port,
      close() {
        server.close()
        ssh.end()
      },
    }
  } catch (e) {
    ssh.end()
    throw e
  }
}
