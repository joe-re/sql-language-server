import { execute } from "../../src/rules";
import { applyFixes } from "../testUtil";

test("valid case", () => {
  const sql = `
    SELECT
      foo.a,
      foo.b
    FROM
      foo
  `;
  const result = execute(sql, {
    rules: { "align-column-to-the-first": { level: 2 } },
  });
  expect(result).toEqual([]);
});

describe("invalid cases", () => {
  test("it should work to align columns properly", () => {
    const sql = `
      SELECT
        foo.a,
          foo.b,
      foo.c
      FROM
        foo
    `;
    const result = execute(sql, {
      rules: { "align-column-to-the-first": { level: 2 } },
    });
    expect(result.length).toEqual(2);
    expect(result[0].message).toEqual(
      "Columns must align to the first column."
    );
    expect(result[0].location).toEqual({
      start: { column: 11, line: 4, offset: 39 },
      end: { column: 16, line: 4, offset: 44 },
    });
    expect(result[1].message).toEqual(
      "Columns must align to the first column."
    );
    expect(result[1].location).toEqual({
      start: { column: 7, line: 5, offset: 52 },
      end: { column: 7, line: 6, offset: 64 },
    });
    const fixed = applyFixes(sql, result.map((v) => v.fix!).flat());
    expect(fixed).toEqual(`
      SELECT
        foo.a,
        foo.b,
        foo.c
      FROM
        foo
    `);
  });
});
