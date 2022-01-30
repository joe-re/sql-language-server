const { parse } = require("../index");

// https://www.mysqltutorial.org/mysql-update-join/
describe("UPDATE JOIN", () => {
  it("should success to parse", () => {
    const sql = `
      UPDATE T1
      JOIN T2
      ON T1.t2_id = T2.id
      SET T1.name = T2.name
      WHERE T1.name = 1
    `;
    const result = parse(sql);
    expect(result).toBeDefined();
    expect(result.join.length).toEqual(1);
    expect(result.join[0]).toMatchObject({
      type: "table",
      db: "",
      table: "T2",
      as: null,
      join: "INNER JOIN",
    });
  });
});
