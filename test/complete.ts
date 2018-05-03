import test from 'ava';

const fn = async () => Promise.resolve('foo');

test('test', async (t) => {
	t.is(await fn(), 'foo');
});
