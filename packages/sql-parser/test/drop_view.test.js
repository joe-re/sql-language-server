const { parse } = require("../index");

describe("DROP VIEW statement", () => {
	describe("Basic statement", () => {
		it("should success to parse", () => {
			const sql = "DROP VIEW Persons, Customers;";
			const result = parse(sql);
			expect(result).toBeDefined();
			expect(result).toMatchObject({
				type: "drop_view",
				if_exists: null,
				keyword: {
					type: "keyword",
					value: "DROP VIEW",
				},
				views: [
					{
						type: "view",
						value: "Persons",
					},
					{
						type: "view",
						value: "Customers",
					},
				],
        dependency_action: null,
			});
		});
	});

  describe("With IF EXISTS", () => {
    it("should success to parse", () => {
      const sql = "DROP VIEW IF EXISTS Persons, Customers;";
      const result = parse(sql);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        type: "drop_view",
        keyword: {
          type: "keyword",
          value: "DROP VIEW",
        },
        if_exists: {
          type: "keyword",
          value: "IF EXISTS",
        },
        views: [
          {
            type: "view",
            value: "Persons",
          },
          {
            type: "view",
            value: "Customers",
          },
        ],
        dependency_action: null,
      });
    });
  });

  describe('With CASCADE', () => {
    it('should success to parse', () => {
      const sql = 'DROP VIEW Persons CASCADE;'
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'drop_view',
        keyword: {
          type: 'keyword',
          value: 'DROP VIEW'
        },
        views: [
          {
            type: 'view',
            value: 'Persons'
          }
        ],
        dependency_action: {
          type: 'keyword',
          value: 'CASCADE'
        }
      })
    })
  });
});
