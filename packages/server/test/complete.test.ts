import complete from '../complete'

describe('keyword completion', () => {
  test("complete 'SELECT' keyword", () => {
    const result = complete('S', { line: 0, column: 1 })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('SELECT')
  })
  
  describe('FROM keyword', () => {
    test("complete FROM word with the star column", () => {
      const result = complete('SELECT * F', { line: 0, column: 10 })
      expect(result.candidates.length).toEqual(1)
      expect(result.candidates[0].label).toEqual('FROM')
    })

    test("complete FROM word with norm columns", () => {
      const sql = 'SELECT d, f F'
      const result = complete('SELECT d, f F', { line: 0, column: sql.length })
      expect(result.candidates.length).toEqual(1)
      expect(result.candidates[0].label).toEqual('FROM')
    })
  })

  test("complete 'WHERE' keyword", () => {
    const result = complete('SELECT * FROM FOO W', { line: 0, column: 19 })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('WHERE')
  })
  
  
  test("complete 'DISTINCT' keyword", () => {
    const result = complete('SELECT D', { line: 0, column: 9 })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('DISTINCT')
  })

  test("complete 'INESRT' keyword", () => {
    const result = complete('I', { line: 0, column: 1 })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('INSERT')
  })

  test("complete 'INTO' keyword", () => {
    const result = complete('INSERT I', { line: 0, column: 8 })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('INTO')
  })

  test("complete 'INTO' keyword", () => {
    const result = complete('INSERT I', { line: 0, column: 8 })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('INTO')
  })

  test("complete 'VALUES' keyword", () => {
    const sql = 'INSERT INTO FOO ( BAR ) V'
    const result = complete('INSERT INTO FOO (BAR) V', { line: 0, column: sql.length })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('VALUES')
  })

  test("complete 'UPDATE' keyword", () => {
    const sql = 'U'
    const result = complete(sql, { line: 0, column: sql.length })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('UPDATE')
  })

  test("complete 'SET' keyword", () => {
    const sql = 'UPDATE FOO S'
    const result = complete(sql, { line: 0, column: sql.length })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('SET')
  })

  test("complete 'DELETE' keyword", () => {
    const sql = 'D'
    const result = complete(sql, { line: 0, column: sql.length })
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('DELETE')
  })
})

const SIMPLE_SCHEMA = [
  {
    database: null,
    tableName: 'TABLE1',
    columns: [
      { columnName: 'COLUMN1', description: '' },
      { columnName: 'COLUMN2', description: '' }
    ]
  }
]

describe('TableName completion', () => {
  test("complete TableName", () => {
    const result = complete( 'SELECT T FROM TABLE1', { line: 0, column: 8 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('TABLE1')
  })
})

describe('ColumnName completion', () => {
  test("complete ColumnName", () => {
    const result = complete( 'SELECT TABLE1.C FROM TABLE1', { line: 0, column: 15 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })
  
  test("complete ColumnName: cursor on dot", () => {
    const result = complete('SELECT TABLE1. FROM TABLE1', { line: 0, column: 14 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })
  
  test("complete ColumnName:cursor on dot:multi line", () => {
    const result = complete( 'SELECT *\nFROM TABLE1\nWHERE TABLE1.', { line: 2, column: 13 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })
  
  test("complete ColumnName:cursor on dot:using alias", () => {
    const result = complete('SELECT *\nFROM TABLE1 t\nWHERE t.', { line: 2, column: 8 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })
})

describe('From clause', () => {
  test("from clause: complete TableName:single line", () => {
    const result = complete('SELECT TABLE1.COLUMN1 FROM T', { line: 0, column: 28 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('TABLE1')
  })
  
  test("from clause: complete TableName:multi lines", () => {
    const result = complete('SELECT TABLE1.COLUMN1\nFROM T', { line: 1, column: 6 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('TABLE1')
  })
  
  test("from clause: INNER JOIN", () => {
    const result = complete('SELECT TABLE1.COLUMN1 FROM TABLE1 I', { line: 0, column: 35 }, SIMPLE_SCHEMA)
    expect(result.candidates.map(v => v.label)).toContain('INNER JOIN')
  })
  
  test("from clause: LEFT JOIN", () => {
    const result = complete('SELECT TABLE1.COLUMN1 FROM TABLE1 L', { line: 0, column: 35 }, SIMPLE_SCHEMA)
    expect(result.candidates.map(v => v.label).includes('LEFT JOIN'))
  });
  
  test("from clause: complete 'ON' keyword on 'INNER JOIN'", () => {
    const result =
      complete(
        'SELECT TABLE1.COLUMN1 FROM TABLE1 INNER JOIN TABLE2 O',
        { line: 0, column: 53 },
        SIMPLE_SCHEMA
      )
    expect(result.candidates.map(v => v.label)).toContain('ON')
  })
})

describe('Where clasuse', () => {
  test("where clause: complete TableName", () => {
    const result = complete('SELECT TABLE1.COLUMN1 FROM TABLE WHERE T', { line: 0, column: 40 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('TABLE1')
  })
})

describe('cursor on dot', () => {
  test("not complete when a cursor is on dot in string literal", () => {
    const result =
      complete('SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.', { line: 0, column: 63 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(0)
  })
  
  test("not complete column name when a cursor is on dot in from clause", () => {
    const result = complete('SELECT TABLE1.COLUMN1 FROM TABLE1.', { line: 0, column: 34 }, SIMPLE_SCHEMA)
    expect(result.candidates.map(v => v.label)).not.toContain('COLUMN1')
    expect(result.candidates.map(v => v.label)).not.toContain('COLUMN2')
  })
})

const COMPLEX_SCHEMA = [
  {
     database: null,
     tableName: 'employees',
     columns: [
       { columnName: 'job_id', description: '' },
       { columnName: 'employee_id', description: '' },
       { columnName: 'manager_id', description: '' },
       { columnName: 'department_id', description: '' },
       { columnName: 'first_name', description: '' },
       { columnName: 'last_name', description: '' },
       { columnName: 'email', description: '' },
       { columnName: 'phone_number', description: '' },
       { columnName: 'hire_date', description: '' },
       { columnName: 'salary', description: '' },
       { columnName: 'commision_pct', description: '' },
     ]
  },
  {
     database: null,
     tableName: 'jobs',
     columns: [
       { columnName: 'job_id', description: '' },
       { columnName: 'job_title', description: '' },
       { columnName: 'min_salary', description: '' },
       { columnName: 'max_salary', description: '' },
       { columnName: 'created_at', description: '' },
       { columnName: 'updated_at', description: '' },
     ]
  },
  {
     database: null,
     tableName: 'job_history',
     columns: [
       { columnName: 'employee_id', description: '' },
       { columnName: 'start_date', description: '' },
       { columnName: 'end_date', description: '' },
       { columnName: 'job_id', description: '' },
       { columnName: 'department_id', description: '' },
     ]
  },
  {
     database: null,
     tableName: 'departments',
     columns: [
       { columnName: 'department_id', description: '' },
       { columnName: 'department_name', description: '' },
       { columnName: 'manager_id', description: '' },
       { columnName: 'location_id', description: '' },
     ]
  },
  {
     database: null,
     tableName: 'locations',
     columns: [
       { columnName: 'location_id', description: '' },
       { columnName: 'street_address', description: '' },
       { columnName: 'postal_code', description: '' },
       { columnName: 'city', description: '' },
       { columnName: 'state_province', description: '' },
       { columnName: 'country_id', description: '' },
     ]
  },
  {
     database: null,
     tableName: 'countries',
     columns: [
       { columnName: 'country_id', description: '' },
       { columnName: 'country_name', description: '' },
       { columnName: 'region_id', description: '' },
     ]
  },
  {
     database: null,
     tableName: 'regions',
     columns: [
       { columnName: 'region_id', description: '' },
       { columnName: 'region_name', description: '' },
     ]
  },
]

test("conplete columns from duplicated alias", () => {
  const sql = `
    SELECT dm.
      FROM employees e
        JOIN jobs j
          ON e.job_id = j.job_id
        LEFT JOIN employees m
          ON e.manager_id = m.manager_id
        LEFT JOIN departments d
          ON d.department_id = e.department_id
        LEFT JOIN employees dm
          ON d.manager_id = dm.employee_id
  `
  const result = complete(sql, { line: 1, column: 14 }, COMPLEX_SCHEMA)
  expect(result.candidates.length).toEqual(11)
})

test("conplete columns innside function", () => {
  const sql = `
    SELECT
      e.employee_id AS "Employee #"
      , e.first_name || ' ' || e.last_name AS "Name"
      , e.email AS "Email"
      , e.phone_number AS "Phone"
      , TO_CHAR(e., 'MM/DD/YYYY') AS "Hire Date"
    FROM employees e
      JOIN jobs j
        ON e.job_id = j.job_id
      LEFT JOIN employees m
        ON e.manager_id = m.manager_id
      LEFT JOIN departments d
        ON d.department_id = e.department_id
      LEFT JOIN employees dm
        ON d.manager_id = dm.employee_id
      LEFT JOIN locations l
        ON d.location_id = l.location_id
      LEFT JOIN countries c
        ON l.country_id = c.country_id
      LEFT JOIN regions r
        ON c.region_id = r.region_id
      LEFT JOIN job_history jh
        ON e.employee_id = jh.employee_id
      LEFT JOIN jobs jj
        ON jj.job_id = jh.job_id
      LEFT JOIN departments d
        ON dd.department_id = jh.department_id
      ORDER BY e.employee_id;
  `
  const result = complete(sql, { line: 6, column: 18 }, COMPLEX_SCHEMA)
  expect(result.candidates.length).toEqual(11)
})

describe('From clause subquery', () => {
  test("complete column name inside from clause subquery", () => {
    const sql = 'SELECT sub FROM (SELECT e. FROM employees e) sub'
    const result = complete(sql, { line: 0, column: 26 }, COMPLEX_SCHEMA)
    expect(result.candidates.length).toEqual(11)
  })
  
  test("complete column name inside from clause subquery:nested", () => {
    const sql = 'SELECT sub FROM (SELECT e.employee_id FROM (SELECT e2. FROM employees e2) e) sub'
    const result = complete(sql, { line: 0, column: 54 }, COMPLEX_SCHEMA)
    expect(result.candidates.length).toEqual(11)
  })
  
  test("complete column name inside from clause subquery:multiline", () => {
    const sql = 'SELECT sub\n FROM (SELECT e. FROM employees e) sub'
    const result = complete(sql, { line: 1, column: 16 }, COMPLEX_SCHEMA)
    expect(result.candidates.length).toEqual(11)
  })
  
  test("complete column name from subquery", () => {
    const sql = 'SELECT sub. FROM (SELECT e.employee_id sub_id FROM employees e) sub'
    const result = complete(sql, { line: 0, column: 11 }, COMPLEX_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('sub_id')
  })
})

describe('INSERT statement', () => {
  test('complete table name', () => {
    const sql = 'INSERT INTO T'
    const result = complete(sql, { line: 0, column: sql.length }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('TABLE1')
  })

  test('complete column name', () => {
    const sql = 'INSERT INTO TABLE1 (C'
    const result = complete(sql, { line: 0, column: sql.length }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })
})

describe('UPDATE statement', () => {
  test('complete table name', () => {
    const sql = 'UPDATE T'
    const result = complete(sql, { line: 0, column: sql.length }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('TABLE1')
  })

  test('complete column name', () => {
    const sql = 'UPDATE TABLE1 SET C'
    const result = complete(sql, { line: 0, column: sql.length }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })
})

describe('DELETE statement', () => {
  test('complete table name', () => {
    const sql = 'DELETE FROM T'
    const result = complete(sql, { line: 0, column: sql.length }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('TABLE1')
  })

  test('complete table name', () => {
    const sql = 'DELETE FROM TABLE1 WHERE C'
    const result = complete(sql, { line: 0, column: sql.length }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })
})