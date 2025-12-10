import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SupabaseManagementClient, ApiError } from "../../src/client/index.js";
import { getTestConfig, delay } from "./setup.js";

/**
 * Functional tests using the test_data table
 *
 * Table: test_data (id serial, name text, value int, category text, active bool, metadata jsonb, created_at timestamptz)
 * Pre-populated: item_a(100,electronics), item_b(200,electronics), item_c(150,clothing), item_d(300,electronics), item_e(50,food)
 */

describe("Functional Tests with test_data", () => {
  let client: SupabaseManagementClient;
  let projectRef: string;

  // SQL helper with retry on rate limit
  async function sql(query: string): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await client.executeSql(projectRef, query);
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 429 && attempt < 2) {
          await delay((attempt + 1) * 2000);
          continue;
        }
        throw error;
      }
    }
    throw new Error("Max retries");
  }

  beforeAll(() => {
    const config = getTestConfig();
    client = new SupabaseManagementClient(config.accessToken);
    projectRef = config.projectRef;
  });

  beforeEach(async () => {
    await delay(300); // Prevent rate limiting
  });

  describe("SELECT queries", () => {
    it("selects all rows", async () => {
      const result = await sql("SELECT * FROM test_data ORDER BY id") as Array<{ id: number; name: string }>;
      expect(result).toHaveLength(5);
      expect(result[0].name).toBe("item_a");
    });

    it("selects with WHERE clause", async () => {
      const result = await sql("SELECT * FROM test_data WHERE category = 'electronics'") as Array<{ category: string }>;
      expect(result).toHaveLength(3);
      expect(result.every(r => r.category === "electronics")).toBe(true);
    });

    it("selects with boolean filter", async () => {
      const result = await sql("SELECT * FROM test_data WHERE active = false") as Array<{ name: string }>;
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("item_c");
    });

    it("selects with numeric comparison", async () => {
      const result = await sql("SELECT * FROM test_data WHERE value >= 150 ORDER BY value") as Array<{ value: number }>;
      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(150);
    });

    it("uses LIMIT and OFFSET", async () => {
      const result = await sql("SELECT name FROM test_data ORDER BY id LIMIT 2 OFFSET 2") as Array<{ name: string }>;
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("item_c");
    });

    it("uses ORDER BY DESC", async () => {
      const result = await sql("SELECT value FROM test_data ORDER BY value DESC LIMIT 3") as Array<{ value: number }>;
      expect(result[0].value).toBe(300);
      expect(result[1].value).toBe(200);
    });

    it("uses IN clause", async () => {
      const result = await sql("SELECT name FROM test_data WHERE category IN ('food', 'clothing') ORDER BY name") as Array<{ name: string }>;
      expect(result).toHaveLength(2);
    });

    it("uses BETWEEN", async () => {
      const result = await sql("SELECT value FROM test_data WHERE value BETWEEN 100 AND 200") as Array<{ value: number }>;
      expect(result).toHaveLength(3);
    });
  });

  describe("Aggregate functions", () => {
    it("counts rows", async () => {
      const result = await sql("SELECT COUNT(*) as total FROM test_data") as Array<{ total: string }>;
      expect(Number(result[0].total)).toBe(5);
    });

    it("calculates SUM", async () => {
      const result = await sql("SELECT SUM(value) as total FROM test_data") as Array<{ total: string }>;
      expect(Number(result[0].total)).toBe(800);
    });

    it("calculates AVG", async () => {
      const result = await sql("SELECT AVG(value)::int as avg FROM test_data") as Array<{ avg: number }>;
      expect(result[0].avg).toBe(160);
    });

    it("finds MIN and MAX", async () => {
      const result = await sql("SELECT MIN(value) as min, MAX(value) as max FROM test_data") as Array<{ min: number; max: number }>;
      expect(Number(result[0].min)).toBe(50);
      expect(Number(result[0].max)).toBe(300);
    });

    it("uses GROUP BY", async () => {
      const result = await sql("SELECT category, COUNT(*) as cnt FROM test_data GROUP BY category ORDER BY category") as Array<{ category: string; cnt: string }>;
      expect(result).toHaveLength(3);
      const electronics = result.find(r => r.category === "electronics");
      expect(Number(electronics?.cnt)).toBe(3);
    });

    it("uses HAVING", async () => {
      const result = await sql("SELECT category, COUNT(*) as cnt FROM test_data GROUP BY category HAVING COUNT(*) > 1") as Array<{ category: string }>;
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("electronics");
    });
  });

  describe("JSONB operations", () => {
    it("extracts JSONB field", async () => {
      const result = await sql("SELECT name, metadata->>'color' as color FROM test_data WHERE metadata->>'color' IS NOT NULL ORDER BY name") as Array<{ name: string; color: string }>;
      expect(result).toHaveLength(4);
      expect(result[0].color).toBe("red");
    });

    it("filters by JSONB field", async () => {
      const result = await sql("SELECT name FROM test_data WHERE metadata->>'size' = 'L'") as Array<{ name: string }>;
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("item_b");
    });

    it("checks JSONB key existence", async () => {
      const result = await sql("SELECT name FROM test_data WHERE metadata ? 'organic'") as Array<{ name: string }>;
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("item_e");
    });
  });

  describe("INSERT operations", () => {
    it("inserts and cleans up", async () => {
      const result = await sql("INSERT INTO test_data (name, value, category) VALUES ('test_insert', 999, 'test') RETURNING *") as Array<{ name: string; value: number }>;
      expect(result[0].name).toBe("test_insert");
      expect(result[0].value).toBe(999);
      await sql("DELETE FROM test_data WHERE name = 'test_insert'");
    });

    it("inserts with JSONB", async () => {
      const result = await sql(`INSERT INTO test_data (name, value, category, metadata) VALUES ('jsonb_test', 100, 'test', '{"key": "value"}') RETURNING metadata`) as Array<{ metadata: { key: string } }>;
      expect(result[0].metadata.key).toBe("value");
      await sql("DELETE FROM test_data WHERE name = 'jsonb_test'");
    });

    it("uses DEFAULT values", async () => {
      const result = await sql("INSERT INTO test_data (name, value, category) VALUES ('default_test', 1, 'test') RETURNING active") as Array<{ active: boolean }>;
      expect(result[0].active).toBe(true);
      await sql("DELETE FROM test_data WHERE name = 'default_test'");
    });
  });

  describe("UPDATE operations", () => {
    it("updates single row", async () => {
      await sql("INSERT INTO test_data (name, value, category) VALUES ('update_test', 100, 'test')");
      const result = await sql("UPDATE test_data SET value = 999 WHERE name = 'update_test' RETURNING value") as Array<{ value: number }>;
      expect(result[0].value).toBe(999);
      await sql("DELETE FROM test_data WHERE name = 'update_test'");
    });

    it("updates with arithmetic", async () => {
      await sql("INSERT INTO test_data (name, value, category) VALUES ('arith_test', 100, 'test')");
      const result = await sql("UPDATE test_data SET value = value * 2 + 50 WHERE name = 'arith_test' RETURNING value") as Array<{ value: number }>;
      expect(result[0].value).toBe(250);
      await sql("DELETE FROM test_data WHERE name = 'arith_test'");
    });

    it("updates JSONB", async () => {
      await sql(`INSERT INTO test_data (name, value, category, metadata) VALUES ('jsonb_upd', 1, 'test', '{"old": true}')`);
      const result = await sql(`UPDATE test_data SET metadata = metadata || '{"new": true}' WHERE name = 'jsonb_upd' RETURNING metadata`) as Array<{ metadata: { old: boolean; new: boolean } }>;
      expect(result[0].metadata.new).toBe(true);
      await sql("DELETE FROM test_data WHERE name = 'jsonb_upd'");
    });
  });

  describe("DELETE operations", () => {
    it("deletes with RETURNING", async () => {
      await sql("INSERT INTO test_data (name, value, category) VALUES ('delete_me', 100, 'test')");
      const result = await sql("DELETE FROM test_data WHERE name = 'delete_me' RETURNING name") as Array<{ name: string }>;
      expect(result[0].name).toBe("delete_me");
      const check = await sql("SELECT * FROM test_data WHERE name = 'delete_me'") as Array<unknown>;
      expect(check).toHaveLength(0);
    });
  });

  describe("Complex queries", () => {
    it("uses subquery", async () => {
      const result = await sql(`SELECT name FROM test_data WHERE value > (SELECT AVG(value) FROM test_data) ORDER BY value`) as Array<{ name: string }>;
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("item_b");
    });

    it("uses CTE", async () => {
      const result = await sql(`WITH stats AS (SELECT category, AVG(value) as avg FROM test_data GROUP BY category) SELECT category FROM stats WHERE avg > 100 ORDER BY avg DESC`) as Array<{ category: string }>;
      expect(result[0].category).toBe("electronics");
    });

    it("uses CASE", async () => {
      const result = await sql(`SELECT name, CASE WHEN value >= 200 THEN 'high' WHEN value >= 100 THEN 'medium' ELSE 'low' END as tier FROM test_data ORDER BY value DESC`) as Array<{ name: string; tier: string }>;
      expect(result[0].tier).toBe("high");
      expect(result[4].tier).toBe("low");
    });

    it("uses COALESCE", async () => {
      await sql("INSERT INTO test_data (name, value, category) VALUES ('null_test', NULL, 'test')");
      const result = await sql("SELECT COALESCE(value, 0) as val FROM test_data WHERE name = 'null_test'") as Array<{ val: number }>;
      expect(result[0].val).toBe(0);
      await sql("DELETE FROM test_data WHERE name = 'null_test'");
    });

    it("uses string functions", async () => {
      const result = await sql("SELECT UPPER(name) as upper, LENGTH(name) as len FROM test_data WHERE id = 1") as Array<{ upper: string; len: number }>;
      expect(result[0].upper).toBe("ITEM_A");
      expect(result[0].len).toBe(6);
    });
  });

  describe("Window functions", () => {
    it("uses ROW_NUMBER", async () => {
      const result = await sql("SELECT name, ROW_NUMBER() OVER (ORDER BY value DESC) as rn FROM test_data ORDER BY rn") as Array<{ name: string; rn: string }>;
      expect(Number(result[0].rn)).toBe(1);
      expect(result[0].name).toBe("item_d");
    });

    it("uses running total", async () => {
      const result = await sql("SELECT name, SUM(value) OVER (ORDER BY id) as running FROM test_data ORDER BY id") as Array<{ name: string; running: string }>;
      expect(Number(result[0].running)).toBe(100);
      expect(Number(result[4].running)).toBe(800);
    });
  });
});

describe("Table schema operations", () => {
  let client: SupabaseManagementClient;
  let projectRef: string;

  async function sql(query: string): Promise<unknown> {
    return client.executeSql(projectRef, query);
  }

  beforeAll(() => {
    const config = getTestConfig();
    client = new SupabaseManagementClient(config.accessToken);
    projectRef = config.projectRef;
  });

  beforeEach(async () => {
    await delay(300);
  });

  it("verifies test_data table exists", async () => {
    const result = await client.listTables(projectRef) as Array<{ name: string }>;
    expect(result.map(t => t.name)).toContain("test_data");
  });

  it("gets column info", async () => {
    const result = await sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'test_data'") as Array<{ column_name: string }>;
    const cols = result.map(c => c.column_name);
    expect(cols).toContain("id");
    expect(cols).toContain("name");
    expect(cols).toContain("metadata");
  });

  it("creates and drops index", async () => {
    await sql("CREATE INDEX IF NOT EXISTS idx_test_category ON test_data (category)");
    const result = await sql("SELECT indexname FROM pg_indexes WHERE indexname = 'idx_test_category'") as Array<{ indexname: string }>;
    expect(result).toHaveLength(1);
    await sql("DROP INDEX IF EXISTS idx_test_category");
  });

  it("adds and removes column", async () => {
    await sql("ALTER TABLE test_data ADD COLUMN IF NOT EXISTS temp_col text");
    const result = await sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'test_data' AND column_name = 'temp_col'") as Array<{ column_name: string }>;
    expect(result).toHaveLength(1);
    await sql("ALTER TABLE test_data DROP COLUMN IF EXISTS temp_col");
  });
});
