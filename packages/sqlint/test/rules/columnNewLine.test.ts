import { execute } from "../../src/rules";
import { applyFixes } from "../testUtil";

test("valid case", () => {
  const sqls = [
    "SELECT * from foo",
    `
   SELECT foo.a
   FROM foo
  `,
    `
    SELECT
      foo.a,
      foo.b
    FROM
      foo
  `,
  ];
  sqls.forEach((v) => {
    const result = execute(v, { rules: { "column-new-line": { level: 2 } } });
    expect(result).toEqual([]);
  });
});

describe("invalid cases", () => {
  test("Columns must go on a new line", () => {
    const sql = `
      SELECT
        foo.a , foo.b , foo.c , foo.d
      FROM
        foo
    `;
    const result = execute(sql, { rules: { "column-new-line": { level: 2 } } });
    expect(result.length).toEqual(3);
    expect(result[0].message).toEqual("Columns must go on a new line.");
    expect(result[0].location).toEqual({
      start: { column: 17, line: 3, offset: 30 },
      end: { column: 23, line: 3, offset: 36 },
    });
    expect(result[1].message).toEqual("Columns must go on a new line.");
    expect(result[1].location).toEqual({
      start: { column: 25, line: 3, offset: 38 },
      end: { column: 31, line: 3, offset: 44 },
    });
    const fixed = applyFixes(sql, result.map((v) => v.fix!).flat());
    expect(fixed).toEqual(`
      SELECT
        foo.a ,
        foo.b ,
        foo.c ,
        foo.d
      FROM
        foo
    `);
  });

  it("should work properly enven if it's with align-column-to-the-first", () => {
    const sql = `
SELECT
  e.email,
  e.first_name, e.hire_date
FROM
  employes e
WHERE
  e.job_id = "jobid1"
    `;
    const result = execute(sql, {
      rules: {
        "column-new-line": { level: 2 },
        "align-column-to-the-first": { level: 2 },
      },
    });
    expect(result.length).toEqual(1);
    expect(result[0].message).toEqual("Columns must go on a new line.");
    expect(result[0].location).toEqual({
      start: { column: 17, line: 4, offset: 35 },
      end: { column: 1, line: 5, offset: 47 },
    });
    const fixed = applyFixes(sql, result.map((v) => v.fix!).flat());
    expect(fixed).toEqual(`
SELECT
  e.email,
  e.first_name,
  e.hire_date
FROM
  employes e
WHERE
  e.job_id = "jobid1"
    `);
  });
});
