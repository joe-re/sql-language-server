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