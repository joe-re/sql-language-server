import test from 'ava'
import complete from '../server/complete'

test("complete 'SELECT' keyword", (t) => {
  const result = complete('S', { line: 0, column: 1 })
  t.is(result.candidates.length, 1);
  t.is(result.candidates[0], 'SELECT');
});

test("complete 'FROM' keyword", (t) => {
  const result = complete('SELECT * F', { line: 0, column: 10 })
  t.is(result.candidates.length, 1);
  t.is(result.candidates[0], 'FROM');
});

test("complete 'WHERE' keyword", (t) => {
  const result = complete('SELECT * FROM FOO W', { line: 0, column: 19 })
  t.is(result.candidates.length, 1);
  t.is(result.candidates[0], 'WHERE');
});


test("complete 'DISTINCT' keyword", (t) => {
  const result = complete('SELECT D', { line: 0, column: 9 })
  t.is(result.candidates.length, 1);
  t.is(result.candidates[0], 'DISTINCT');
});

test("complete TableName", (t) => {
  const result =
    complete(
      'SELECT T FROM TABLE1',
      { line: 0, column: 8 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 1);
  t.is(result.candidates[0], 'TABLE1');
});

test("complete ColumnName", (t) => {
  const result =
    complete(
      'SELECT TABLE1.C FROM TABLE1',
      { line: 0, column: 15 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 2);
  t.is(result.candidates[0], 'COLUMN1');
  t.is(result.candidates[1], 'COLUMN2');
});

test("complete ColumnName: cursor on dot", (t) => {
  const result =
    complete(
      'SELECT TABLE1. FROM TABLE1',
      { line: 0, column: 14 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 2);
  t.is(result.candidates[0], 'COLUMN1');
  t.is(result.candidates[1], 'COLUMN2');
});

test("complete ColumnName:cursor on dot:multi line", (t) => {
  const result =
    complete(
      'SELECT *\nFROM TABLE1\nWHERE TABLE1.',
      { line: 2, column: 13 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 2);
  t.is(result.candidates[0], 'COLUMN1');
  t.is(result.candidates[1], 'COLUMN2');
});

test("complete ColumnName:cursor on dot:using alias", (t) => {
  const result =
    complete(
      'SELECT *\nFROM TABLE1 t\nWHERE t.',
      { line: 2, column: 8 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 2);
  t.is(result.candidates[0], 'COLUMN1');
  t.is(result.candidates[1], 'COLUMN2');
});

test("from clause: complete TableName", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1 FROM T',
      { line: 0, column: 28 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 1);
  t.is(result.candidates[0], 'TABLE1');
});

test("from clause: complete TableName:multi lines", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1\nFROM T',
      { line: 1, column: 6 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 1);
  t.is(result.candidates[0], 'TABLE1');
});

test("from clause: INNER JOIN", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1 FROM TABLE1 I',
      { line: 0, column: 35 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.truthy(result.candidates.includes('INNER JOIN'));
});

test("from clause: LEFT JOIN", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1 FROM TABLE1 L',
      { line: 0, column: 35 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.truthy(result.candidates.includes('LEFT JOIN'));
});

test("from clause: complete 'ON' keyword on 'INNER JOIN'", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1 FROM TABLE1 INNER JOIN TABLE2 O',
      { line: 0, column: 53 },
      [
        { table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] },
        { table: 'TABLE2', columns: ['COLUMN1', 'COLUMN2'] }
      ]
    )
  t.truthy(result.candidates.includes('ON'));
});

test("where clause: complete TableName", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1 FROM TABLE WHERE T',
      { line: 0, column: 40 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 1);
  t.is(result.candidates[0], 'TABLE1');
});

test("not complete when a cursor is on dot in string literal", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.',
      { line: 0, column: 63 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.is(result.candidates.length, 0);
});

test("not complete column name when a cursor is on dot in from clause", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1 FROM TABLE1.',
      { line: 0, column: 34 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  t.false(result.candidates.includes('COLUMN1'));
  t.false(result.candidates.includes('COLUMN2'));
});

const COMPLEX_TABLES = [
  { table: 'employees', columns: ['job_id', 'employee_id', 'manager_id', 'department_id', 'first_name', 'last_name', 'email', 'phone_number', 'hire_date', 'salary', 'commision_pct'] },
  { table: 'jobs', columns: ['job_id', 'job_title', 'min_salary', 'max_salary', 'created_at', 'updated_at'] },
  { table: 'job_history', columns: ['employee_id', 'start_date', 'end_date', 'job_id', 'department_id'] },
  { table: 'departments', columns: ['department_id', 'department_name', 'manager_id', 'location_id'] },
  { table: 'locations', columns: ['location_id', 'street_address', 'postal_code', 'ciry', 'state_province', 'country_id'] },
  { table: 'countries', columns: ['country_id', 'country_name', 'region_id'] },
  { table: 'regions', columns: ['region_id', 'region_name'] },
]

test("conplete columns from duplicated alias", (t) => {
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
  const result = complete(sql, { line: 1, column: 14 }, COMPLEX_TABLES)
  t.is(result.candidates.length, 11);
})

test("conplete columns innside function", (t) => {
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
  const result = complete(sql, { line: 6, column: 18 }, COMPLEX_TABLES)
  t.is(result.candidates.length, 11);
})


test("complete column name inside from clause subquery", (t) => {
  const sql = 'SELECT sub FROM (SELECT e. FROM employees e) sub'
  const result = complete(sql, { line: 0, column: 26 }, COMPLEX_TABLES)
  t.is(result.candidates.length, 11);
})

test("complete column name inside from clause subquery:nested", (t) => {
  const sql = 'SELECT sub FROM (SELECT e.employee_id FROM (SELECT e2. FROM employees e2) e) sub'
  const result = complete(sql, { line: 0, column: 54 }, COMPLEX_TABLES)
  t.is(result.candidates.length, 11);
})

test("complete column name inside from clause subquery:multiline", (t) => {
  const sql = 'SELECT sub\n FROM (SELECT e. FROM employees e) sub'
  const result = complete(sql, { line: 1, column: 16 }, COMPLEX_TABLES)
  t.is(result.candidates.length, 11);
})
