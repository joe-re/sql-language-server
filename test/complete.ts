import test from 'ava'
import complete from '../src/complete'

test("complete 'SELECT' key word", async (t) => {
  const result = complete('S', { line: 1, column: 1 })
	t.is(result.candidates.length, 1);
	t.is(result.candidates[0], 'SELECT');
});

test("complete 'FROM' key word", async (t) => {
  const result = complete('SELECT * F', { line: 1, column: 10 })
	t.is(result.candidates.length, 1);
	t.is(result.candidates[0], 'FROM');
});

test("complete 'WHERE' key word", async (t) => {
  const result = complete('SELECT * FROM FOO W', { line: 1, column: 10 })
	t.is(result.candidates.length, 1);
	t.is(result.candidates[0], 'WHERE');
});
