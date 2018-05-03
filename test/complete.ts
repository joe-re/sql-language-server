import test from 'ava'
import complete from '../src/complete'

test("complete 'select' key word", async (t) => {
  const result = complete('S', { line: 1, column: 1 })
	t.is(result.candidates.length, 1);
	t.is(result.candidates[0], 'SELECT');
});
