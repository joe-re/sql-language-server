const { parse } = require('../index');

describe('SET statement', () => {
  describe('Basic statement', () => {
    it('should success to parse variable assignments', () => {
      const sql = 'SET @var1 = 1, @var2 = 2;';
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: [
          {
            type: 'variable',
            name: '@var1',
            value: {
              type: 'number',
              value: 1,
            },
          },
          {
            type: 'variable',
            name: '@var2',
            value: {
              type: 'number',
              value: 2,
            },
          },
        ],
      });
    });
  });

  describe('Session Authorization', () => {
    it('should parse session authorization with TO', () => {
      const sql = "SET SESSION AUTHORIZATION TO 'username';";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'session_authorization',
          value: {
            type: 'string',
            value: 'username',
          },
        },
      });
    });

    it('should parse session authorization with =', () => {
      const sql = "SET SESSION AUTHORIZATION = 'username';";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'session_authorization',
          value: {
            type: 'string',
            value: 'username',
          },
        },
      });
    });
  });

  describe('Search Path', () => {
    it('should parse search path with TO', () => {
      const sql = "SET search_path TO 'public', 'myschema';";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'search_path',
          value: [
            { type: 'string', value: 'public' },
            { type: 'string', value: 'myschema' },
          ],
        },
      });
    });

    it('should parse search path with =', () => {
      const sql = "SET search_path = 'public', 'myschema';";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'search_path',
          value: [
            { type: 'string', value: 'public' },
            { type: 'string', value: 'myschema' },
          ],
        },
      });
    });
  });

  describe('Transaction', () => {
    it('should parse transaction local', () => {
      const sql = "SET TRANSACTION LOCAL;";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'transaction',
          value: 'LOCAL',
        },
      });
    });

    it('should parse transaction default', () => {
      const sql = "SET TRANSACTION DEFAULT;";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'transaction',
          value: 'DEFAULT',
        },
      });
    });
  });

  describe('Role', () => {
    it('should parse role with TO', () => {
      const sql = "SET ROLE TO 'role_name';";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'role',
          value: {
            type: 'string',
            value: 'role_name',
          },
        },
      });
    });

    it('should parse role with =', () => {
      const sql = "SET ROLE = 'role_name';";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'role',
          value: {
            type: 'string',
            value: 'role_name',
          },
        },
      });
    });
  });

  describe('Time Zone', () => {
    it('should parse time zone with TO', () => {
      const sql = "SET TIME ZONE TO 'UTC';";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'time_zone',
          value: {
            type: 'string',
            value: 'UTC',
          },
        },
      });
    });

    it('should parse time zone with =', () => {
      const sql = "SET TIME ZONE = 'UTC';";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'time_zone',
          value: {
            type: 'string',
            value: 'UTC',
          },
        },
      });
    });

    it('should parse time zone local', () => {
      const sql = "SET TIME ZONE LOCAL;";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'time_zone',
          value: 'LOCAL',
        },
      });
    });

    it('should parse time zone default', () => {
      const sql = "SET TIME ZONE DEFAULT;";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: 'set',
        assignments: {
          type: 'time_zone',
          value: 'DEFAULT',
        },
      });
    });
  });
});