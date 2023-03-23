

const { parse } = require('../index')

describe('WITH', () => {
  describe('basic parse rules', () => {
    test('has one cte', () => {
      const sql = `
      WITH temporary_table AS (
        SELECT product_id, SUM(revenue) AS total_revenue
        FROM sales_data
        GROUP BY product_id
      )
      SELECT product_id, total_revenue
      FROM temporary_table
      WHERE total_revenue > 10000;
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('select')
      const actualWith = result.with
      expect(actualWith.type).toEqual('with')
      expect(actualWith.keyword).toMatchObject({ type: 'keyword', value: 'WITH' })
      expect(actualWith.cteList).toHaveLength(1)
      expect(actualWith.cteList[0].type).toEqual('cte')
      expect(actualWith.cteList[0].name).toEqual('temporary_table')
      expect(actualWith.cteList[0].arguments).toHaveLength(0)
      expect(actualWith.cteList[0].query.type).toEqual('select')
    })

    test('has more than one ctes', () => {
      const sql = `
      WITH temporary_table AS (
        SELECT product_id, SUM(revenue) AS total_revenue
        FROM sales_data
        GROUP BY product_id
      ),
      temporary_table2 AS (
        SELECT product_id, SUM(revenue) AS total_revenue
        FROM sales_data
        GROUP BY product_id
      )
      SELECT product_id, total_revenue
      FROM temporary_table, temporary_table2
      WHERE temporary_table.total_revenue > 10000 AND temporary_table2.total_revenue > 5000;
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('select')
      const actualWith = result.with
      expect(actualWith.type).toEqual('with')
      expect(actualWith.keyword).toMatchObject({ type: 'keyword', value: 'WITH' })
      expect(actualWith.cteList).toHaveLength(2)
      expect(actualWith.cteList[0].type).toEqual('cte')
      expect(actualWith.cteList[0].name).toEqual('temporary_table')
      expect(actualWith.cteList[0].arguments).toHaveLength(0)
      expect(actualWith.cteList[0].query.type).toEqual('select')
      expect(actualWith.cteList[1].type).toEqual('cte')
      expect(actualWith.cteList[1].name).toEqual('temporary_table2')
      expect(actualWith.cteList[0].arguments).toHaveLength(0)
      expect(actualWith.cteList[0].query.type).toEqual('select')
    })

    test('recursive', () => {
      const sql = `
      WITH RECURSIVE seq_list(seq_no) AS (
        SELECT 1
        UNION ALL
        SELECT seq_no + 1
        FROM seq_list
        WHERE seq_no < 10
      )
      SELECT * FROM seq_list;
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('select')
      const actualWith = result.with
      expect(actualWith.type).toEqual('with')
      expect(actualWith.keyword).toMatchObject({ type: 'keyword', value: 'WITH' })
      expect(actualWith.cteList).toHaveLength(1)
      expect(actualWith.cteList[0].type).toEqual('cte')
      expect(actualWith.cteList[0].name).toEqual('seq_list')
      expect(actualWith.cteList[0].arguments).toHaveLength(1)
      expect(actualWith.cteList[0].arguments[0]).toEqual('seq_no')
      expect(actualWith.cteList[0].query.type).toEqual('select')
    })
  })

  describe('in INSERT statement', () => {
    it('successes to parse', () => {
      const sql = `
      WITH filtered_products AS (
        SELECT id, product_name, price
        FROM products
        WHERE price > 100
      )
      INSERT INTO item (product_id, product_name, price)
      VALUES (
        (select id, product_name, price from filtered_products where id='xxxxxxxxxxxxx'),
        50000,
        'xxxxxxxxxx'
      )
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('insert')
      const actualWith = result.with
      expect(actualWith.keyword).toMatchObject({ type: 'keyword', value: 'WITH' })
      expect(actualWith.cteList).toHaveLength(1)
      expect(actualWith.cteList[0].type).toEqual('cte')
      expect(actualWith.cteList[0].name).toEqual('filtered_products')
      expect(actualWith.cteList[0].arguments).toHaveLength(0)
      expect(actualWith.cteList[0].query.type).toEqual('select')
    })
  })

  describe('in DELETE statement', () => {
    it('successes to parse', () => {
      const sql = `
      WITH old_orders AS (
        SELECT order_id
        FROM orders
        WHERE order_date < '2020-01-01'
      )
      DELETE FROM orders
      WHERE order_id IN (SELECT order_id FROM old_orders);
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('delete')
      const actualWith = result.with
      expect(actualWith.keyword).toMatchObject({ type: 'keyword', value: 'WITH' })
      expect(actualWith.cteList).toHaveLength(1)
      expect(actualWith.cteList[0].type).toEqual('cte')
      expect(actualWith.cteList[0].name).toEqual('old_orders')
      expect(actualWith.cteList[0].arguments).toHaveLength(0)
      expect(actualWith.cteList[0].query.type).toEqual('select')
    })
  })

  describe('in UPDATE statement', () => {
    it('successes to parse', () => {
      const sql = `
      WITH avg_price AS (
        SELECT category_id, AVG(price) AS average_price
        FROM products
        GROUP BY category_id
      )
      UPDATE products
      SET price = price * 0.9
      WHERE category_id IN (
        SELECT category_id
        FROM avg_price
        WHERE average_price > 150
      );
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('update')
      const actualWith = result.with
      expect(actualWith.keyword).toMatchObject({ type: 'keyword', value: 'WITH' })
      expect(actualWith.cteList).toHaveLength(1)
      expect(actualWith.cteList[0].type).toEqual('cte')
      expect(actualWith.cteList[0].name).toEqual('avg_price')
      expect(actualWith.cteList[0].arguments).toHaveLength(0)
      expect(actualWith.cteList[0].query.type).toEqual('select')
    })
  })
})
