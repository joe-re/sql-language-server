import SettingStore from "../SettingStore"

describe('setSetting', () => {
  beforeAll(() => {
    process.env.setSetting_DB_PASSWORD="replacedPassWord"
    process.env.setSetting_SSH_PASSPHRASE="replacedPassphrase"
  })
  afterAll(() => {
    process.env.setSetting_DB_PASSWORD=""
    process.env.setSetting_SSH_PASSPHRASE=""
  })
  it('should replace ${env:VARIABLE_NAME} syntax with environment variable', () => {
    const setting = {
      "adapter": 'mysql' as 'mysql',
      "host": "localhost",
      "port": 3307,
      "user": "username",
      "password": "${env:setSetting_DB_PASSWORD}",
      "database": "mysql-development",
      "ssh": {
        "user": "ubuntu",
        "remoteHost": "ec2-xxx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
        "dbHost": "127.0.0.1",
        "port": 3306,
        "identityFile": "~/.ssh/id_rsa",
        "passphrase": "${env:setSetting_SSH_PASSPHRASE}"
      }
    }
    const store = SettingStore.getInstance()
    store.setSetting(setting)
    expect(store.getSetting()).toMatchObject({
      "password": "replacedPassWord",
      "ssh": {
        "passphrase": "replacedPassphrase"
      }
    })
  })
})

describe('setSettingFromFile', () => {
  describe('detects only personal config file', () => {
    it('should apply config according to project path', async () => {
      const setting = await SettingStore.getInstance().setSettingFromFile(
        `${__dirname}/fixtures/personalConfigFile.json`,
        'no_project_config',
        '/Users/sql-language-server/project2'
      )
      expect(setting?.name).toEqual('project2')
    })
  })
  describe('detects only project config file', () => {
    it('should apply project config', async () => {
      const setting = await SettingStore.getInstance().setSettingFromFile(
        'no_personal_config',
        `${__dirname}/fixtures/projectConfigFile.json`,
        '/Users/sql-language-server/project2'
      )
      expect(setting?.name).toEqual('project2')
      expect(setting?.database).toEqual('projectConfigDatabase')
    })
  })
  describe('detects both personal and project config files', () => {
    it('should merge both config files and apply it', async () => {
      const setting = await SettingStore.getInstance().setSettingFromFile(
        `${__dirname}/fixtures/personalConfigFile.json`,
        `${__dirname}/fixtures/projectConfigFile.json`,
        '/Users/sql-language-server/project2'
      )
      expect(setting?.name).toEqual('project2')
      expect(setting?.database).toEqual('projectConfigDatabase')
      expect(setting?.password).toEqual('pg_pass')
      expect(setting?.ssh).toMatchObject({
        "user": "ubuntu",
        "remoteHost": "ec2-xxx-xxx-xxx-xxx.ap-southeast-1.compute.amazonaws.com",
        "dbHost": "127.0.0.1",
        "port": 5432,
        "identityFile": "~/.ssh/id_rsa",
        "passphrase": "123456"
      })
    })
  })
})

describe('changeConnection', () => {
  it('should change database connection', async () => {
    await SettingStore.getInstance().setSettingFromFile(
      `${__dirname}/fixtures/personalConfigFile.json`,
      'no_project_config',
      '/Users/sql-language-server/project2'
    )
    expect(SettingStore.getInstance().getSetting().name).toEqual('project2')
    SettingStore.getInstance().changeConnection('project1')
    expect(SettingStore.getInstance().getSetting().name).toEqual('project1')
  })
})