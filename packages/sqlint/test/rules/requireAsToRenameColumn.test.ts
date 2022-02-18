import { execute } from "../../src/rules";
import { applyFixes } from "../testUtil";

test("valid case", () => {
  const sql = `
  SELECT
    employees.name AS employee_name,
    COUNT(tasks.id) AS assigned_task_count
  FROM
    employees LEFT JOIN tasks
      ON employees.id = tasks.id
  `;
  const result = execute(sql, {
    rules: { "require-as-to-rename-column": { level: 2 } },
  });
  expect(result).toEqual([]);
});

test("require as to rename column", () => {
  const sql = `
  SELECT
    employees.name employee_name,
    COUNT(tasks.id) assigned_task_count
  FROM
    employees LEFT JOIN tasks
      ON employees.id = tasks.id
  `;
  const result = execute(sql, {
    rules: { "require-as-to-rename-column": { level: 2 } },
  });
  expect(result.length).toEqual(2);
  expect(result[0].message).toEqual("Require AS keyword to rename a column");
  expect(result[0].location).toEqual({
    start: { column: 5, line: 3, offset: 14 },
    end: { column: 33, line: 3, offset: 42 },
  });
  expect(result[1].message).toEqual("Require AS keyword to rename a column");
  expect(result[1].location).toEqual({
    start: { column: 5, line: 4, offset: 48 },
    end: { column: 40, line: 4, offset: 83 },
  });
  const fixed = applyFixes(sql, result.map((v) => v.fix!).flat());
  expect(fixed).toContain(
    `
  SELECT
    employees.name AS employee_name,
    COUNT(tasks.id) AS assigned_task_count
  FROM
    employees LEFT JOIN tasks
      ON employees.id = tasks.id
`.trim()
  );
});
