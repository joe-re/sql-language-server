const { parse } = require('../index')

describe('CREATE TABLE statement', () => {
  describe('Basic statement', () => {
    it('should success to parse', () => {
      const sql = `CREATE TABLE Persons ( PersonID int, LastName varchar(255));`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'create_table',
        keyword: {
          type: 'keyword',
          value: 'CREATE TABLE'
        },
        if_not_exists: null,
        column_definitions: [
          { type: 'field', name: 'PersonID', data_type: { name: 'int', args: [] } },
          { type: 'field', name: 'LastName', data_type: { name: 'varchar', args: ['255'] } }
        ]
      })
    })
  })


  describe('With IF NOT EXIST', () => {
    it('should success to parse', () => {
      const sql = `CREATE TABLE IF NOT EXISTS Persons ( PersonID int, LastName varchar(255));`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'create_table',
        keyword: {
          type: 'keyword',
          value: 'CREATE TABLE'
        },
        if_not_exists: {
          type: 'keyword',
          value: 'IF NOT EXISTS'
        },
        column_definitions: [
          { type: 'field', name: 'PersonID', data_type: { name: 'int', args: [] } },
          { type: 'field', name: 'LastName', data_type: { name: 'varchar', args: ['255'] } }
        ]
      })
    })
  })

  describe('Constraints', () => {
    it('should success to parse', () => {
      const sql = `
        CREATE TABLE Persons (
          PersonID int NOT NULL UNIQUE PRIMARY KEY AUTO_INCREMENT DEFAULT CURRENT_TIMESTAMP,
          LastName varchar(255)
        );`
      const result = parse(sql)
      expect(result.column_definitions[0].constraints).toBeDefined()
      expect(result.column_definitions[0].constraints.length).toEqual(5)
      expect(result.column_definitions[0].constraints[0].type).toEqual('constraint_not_null')
      expect(result.column_definitions[0].constraints[1].type).toEqual('constraint_unique')
      expect(result.column_definitions[0].constraints[2].type).toEqual('constraint_primary_key')
      expect(result.column_definitions[0].constraints[3].type).toEqual('constraint_auto_increment')
      expect(result.column_definitions[0].constraints[4].type).toEqual('constraint_default')
    })
  })

  describe('Using another table', () => {
    it('should success to parse', () => {
      const sql = `
        CREATE TABLE TestTable AS
        SELECT customername, contactname
        FROM customers;
      `
      const result = parse(sql)
      expect(result).toBeDefined()
    })
  })

  describe('FOREIGN KEY', () => {
    it('should success to parse', () => {
      const sql = `
        CREATE TABLE IF NOT EXISTS purchases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          device_id INT NOT NULL,
          method VARCHAR(255) NOT NULL,
          confirmed_at TIMESTAMP,
          cancelled_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (device_id, item_id) REFERENCES devices(id, item_id)
        );
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.column_definitions).toHaveLength(7)
      expect(result.column_definitions[6].type).toEqual('foreign_key')
      const foreignKey = result.column_definitions[6]
      expect(foreignKey.columns).toHaveLength(2)
      expect(foreignKey.references_table).toEqual('devices')
      expect(foreignKey.references_columns).toHaveLength(2)
      expect(foreignKey.on).toBeNull()
    })

    describe('ON option', () => {
      [
        { trigger: 'DELETE', action: 'CASCADE' },
        { trigger: 'DELETE', action: 'SET NULL' },
        { trigger: 'DELETE', action: 'SET DEFAULT' },
        { trigger: 'DELETE', action: 'RESTRICT' },
        { trigger: 'DELETE', action: 'NO ACTION' },
        { trigger: 'UPDATE', action: 'CASCADE' },
        { trigger: 'UPDATE', action: 'SET NULL' },
        { trigger: 'UPDATE', action: 'SET DEFAULT' },
        { trigger: 'UPDATE', action: 'RESTRICT' },
        { trigger: 'UPDATE', action: 'NO ACTION' }
      ].forEach(({ trigger, action }) => {
        describe(`ON ${trigger} ${action}`, () => {
          const sql = `
            CREATE TABLE IF NOT EXISTS wallets (
              id INT AUTO_INCREMENT PRIMARY KEY,
              device_id INT NOT NULL,
              balance DECIMAL(5, 2),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
              FOREIGN KEY (device_id) REFERENCES devices (id) ON ${trigger} ${action}
            );
          `
          const result = parse(sql)
          expect(result).toBeDefined()
          expect(result.column_definitions).toHaveLength(5)
          expect(result.column_definitions[4].type).toEqual('foreign_key')
          const foreignKey = result.column_definitions[4]
          expect(foreignKey.on).toBeDefined()
          const on = foreignKey.on
          expect(on.type).toEqual('foreign_key_on')
          expect(on.trigger.value).toEqual(trigger)
          expect(on.action.value).toEqual(action)
        })
      })
    })
  })

  describe('PRIMARY KEY', () => {
    it('should success to parse', () => {
      const sql = `
        CREATE TABLE IF NOT EXISTS purchases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          device_id INT NOT NULL,
          method VARCHAR(255) NOT NULL,
          confirmed_at TIMESTAMP,
          cancelled_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (device_id, method)
        );
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.column_definitions).toHaveLength(7)
      expect(result.column_definitions[6].type).toEqual('primary_key')
      const primaryKey = result.column_definitions[6]
      expect(primaryKey.columns).toHaveLength(2)
    })
  })


})