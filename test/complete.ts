import test from 'ava'
import complete from '../src/complete'

test("complete 'SELECT' key word", (t) => {
  const result = complete('S', { line: 1, column: 1 })
	t.is(result.candidates.length, 1);
	t.is(result.candidates[0], 'SELECT');
});

test("complete 'FROM' key word", (t) => {
  const result = complete('SELECT * F', { line: 1, column: 10 })
	t.is(result.candidates.length, 1);
	t.is(result.candidates[0], 'FROM');
});

test("complete 'WHERE' key word", (t) => {
  const result = complete('SELECT * FROM FOO W', { line: 1, column: 19 })
	t.is(result.candidates.length, 1);
	t.is(result.candidates[0], 'WHERE');
});

test("complete TableName", (t) => {
  const result =
	  complete(
		'SELECT T FROM TABLE1',
		{ line: 1, column: 8 },
		[{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
	t.is(result.candidates.length, 1);
	t.is(result.candidates[0], 'TABLE1');
});

test("complete ColumnName", (t) => {
  const result =
	  complete(
		'SELECT TABLE1.C FROM TABLE1',
		{ line: 1, column: 15 },
		[{ table: 'TABLE1', columns: ['COLUMN1', 'COLUMN2'] }])
	t.is(result.candidates.length, 2);
	t.is(result.candidates[0], 'COLUMN1');
	t.is(result.candidates[1], 'COLUMN2');
});
