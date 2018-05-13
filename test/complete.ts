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

test("no complete when a cursor is on dot in string literal", (t) => {
  const result =
    complete(
      'SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.',
      { line: 0, column: 63 },
      [{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
  console.log(result)
  t.is(result.candidates.length, 0);
});
