const { parse } = require('../index');

describe('SET statement', () => {
  describe('Basic statement', () => {
    it('should success to parse', () => {
      const sql = 'SET @var1 = 1, @var2 = 2;';
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        variables: [
          {
            type: 'variable',
            name: '@var1',
            value: {
              type: 'number',
              value: '1',
            },
          },
          {
            type: 'variable',
            name: '@var2',
            value: {
              type: 'number',
              value: '2',
            },
          },
        ],
      });
    });
  });
});