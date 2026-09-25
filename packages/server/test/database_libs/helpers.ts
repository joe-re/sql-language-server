import { Connection } from '../../src/SettingStore'

export function createSettings(overrides: Partial<Connection>): Connection {
  return {
    name: 'test',
    adapter: null,
    host: null,
    port: null,
    user: null,
    database: null,
    password: null,
    filename: null,
    keyFile: null,
    projectId: null,
    projectPaths: [],
    ssh: null,
    jupyterLabMode: false,
    ...overrides,
  }
}

// Integration tests against real databases run only when these are set, e.g.
//   SQLLS_TEST_POSTGRES=postgres://sqlls:sqlls@127.0.0.1:5432/sqlls_test
//   SQLLS_TEST_MYSQL=mysql://sqlls:sqlls@127.0.0.1:3306/sqlls_test
export function settingsFromUrl(
  adapter: Connection['adapter'],
  value: string
): Connection {
  const url = new URL(value)
  return createSettings({
    adapter,
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  })
}
