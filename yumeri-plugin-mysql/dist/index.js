// src/index.ts
import { Logger, Schema } from "yumeri";
import mysql from "mysql2/promise";
var logger = new Logger("mysql");
var provide = ["database"];
function buildWhereClause(query) {
  const conditions = [];
  const params = [];
  for (const key in query) {
    if (key === "$or" || key === "$and") {
      const subQueries = query[key];
      const subResults = subQueries.map(buildWhereClause).filter((r) => r.sql);
      if (subResults.length > 0) {
        const operator = key === "$or" ? " OR " : " AND ";
        conditions.push(`(${subResults.map((r) => r.sql).join(operator)})`);
        params.push(...subResults.flatMap((r) => r.params));
      }
      continue;
    }
    const value = query[key];
    if (value === void 0 || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).some((k) => k.startsWith("$"))) {
      const operatorKeys = Object.keys(value);
      for (const op of operatorKeys) {
        const opValue = value[op];
        if (opValue === void 0 || opValue === null) continue;
        switch (op) {
          case "$eq":
            conditions.push(`\`${key}\` = ?`);
            params.push(opValue);
            break;
          case "$ne":
            conditions.push(`\`${key}\` != ?`);
            params.push(opValue);
            break;
          case "$gt":
            conditions.push(`\`${key}\` > ?`);
            params.push(opValue);
            break;
          case "$gte":
            conditions.push(`\`${key}\` >= ?`);
            params.push(opValue);
            break;
          case "$lt":
            conditions.push(`\`${key}\` < ?`);
            params.push(opValue);
            break;
          case "$lte":
            conditions.push(`\`${key}\` <= ?`);
            params.push(opValue);
            break;
          case "$in":
            if (Array.isArray(opValue) && opValue.length > 0) {
              conditions.push(`\`${key}\` IN (${opValue.map(() => "?").join(",")})`);
              params.push(...opValue);
            }
            break;
          case "$nin":
            if (Array.isArray(opValue) && opValue.length > 0) {
              conditions.push(`\`${key}\` NOT IN (${opValue.map(() => "?").join(",")})`);
              params.push(...opValue);
            }
            break;
        }
      }
    } else {
      conditions.push(`\`${key}\` = ?`);
      params.push(value);
    }
  }
  return { sql: conditions.join(" AND "), params };
}
var MysqlDatabase = class _MysqlDatabase {
  constructor(pool) {
    this.pool = pool;
  }
  static async create(options) {
    const pool = mysql.createPool(options);
    const conn = await pool.getConnection();
    conn.release();
    logger.info("MySQL database connection test successful.");
    return new _MysqlDatabase(pool);
  }
  getFieldDef(def) {
    return typeof def === "string" ? { type: def } : def;
  }
  mapTypeToSql(def) {
    const type = def.type.toUpperCase();
    switch (type) {
      case "STRING":
        return `VARCHAR(${def.length || 255})`;
      case "TEXT":
        return "TEXT";
      case "JSON":
        return "JSON";
      case "INTEGER":
        return "INT";
      case "UNSIGNED":
        return "INT UNSIGNED";
      case "BIGINT":
        return "BIGINT";
      case "FLOAT":
        return "FLOAT";
      case "DOUBLE":
        return "DOUBLE";
      case "DECIMAL":
        return `DECIMAL(${def.precision || 10}, ${def.scale || 2})`;
      case "BOOLEAN":
        return "TINYINT(1)";
      case "DATE":
        return "DATE";
      case "TIME":
        return "TIME";
      case "TIMESTAMP":
        return "TIMESTAMP";
      case "DATETIME":
        return "DATETIME";
      default:
        return type;
    }
  }
  buildColumnSql(field, def) {
    let sql = `\`${field}\` ${this.mapTypeToSql(def)}`;
    if (def.nullable === false) sql += " NOT NULL";
    if (def.initial !== void 0) sql += ` DEFAULT ${this.pool.escape(def.initial)}`;
    if (def.autoIncrement) sql += " AUTO_INCREMENT";
    return sql;
  }
  async extend(table, schema, indexes) {
    const tableName = table;
    const [rows] = await this.pool.query("SHOW TABLES LIKE ?", [tableName]);
    const tableExists = rows.length > 0;
    if (!tableExists) {
      const fields = Object.keys(schema);
      const columns = fields.map((field) => this.buildColumnSql(field, this.getFieldDef(schema[field])));
      if (indexes?.primary) {
        const primaryKeys = Array.isArray(indexes.primary) ? indexes.primary : [indexes.primary];
        columns.push(`PRIMARY KEY (${primaryKeys.map((k) => `\`${k}\``).join(", ")})`);
      }
      if (indexes?.unique) {
        const uniqueKeys = Array.isArray(indexes.unique[0]) ? indexes.unique : indexes.unique.map((k) => Array.isArray(k) ? k : [k]);
        uniqueKeys.forEach((keys) => {
          columns.push(`UNIQUE KEY (${keys.map((k) => `\`${k}\``).join(", ")})`);
        });
      }
      const sql = `CREATE TABLE \`${tableName}\` (${columns.join(", ")}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
      logger.info(`Creating table "${tableName}"`);
      await this.run(sql);
    } else {
      const [existingCols] = await this.pool.query(`DESCRIBE \`${tableName}\``);
      const existingColNames = existingCols.map((c) => c.Field);
      const alterClauses = [];
      for (const field of Object.keys(schema)) {
        const def = this.getFieldDef(schema[field]);
        if (!existingColNames.includes(field)) {
          alterClauses.push(`ADD COLUMN ${this.buildColumnSql(field, def)}`);
        } else {
          const col = existingCols.find((c) => c.Field === field);
          const newColSql = this.buildColumnSql(field, def);
          if (!newColSql.includes(col.Type)) {
            alterClauses.push(`MODIFY COLUMN ${newColSql}`);
          }
        }
      }
      if (alterClauses.length > 0) {
        await this.run(`ALTER TABLE \`${tableName}\` ${alterClauses.join(", ")}`);
      }
      if (indexes) {
        const [existingIndexes] = await this.pool.query(`SHOW INDEX FROM \`${tableName}\``);
        const indexMap = {};
        existingIndexes.forEach((idx) => {
          if (idx.Key_name !== "PRIMARY") {
            if (!indexMap[idx.Key_name]) indexMap[idx.Key_name] = [];
            indexMap[idx.Key_name].push(idx.Column_name);
          }
        });
        if (indexes.primary) {
          const primaryKeys = Array.isArray(indexes.primary) ? indexes.primary : [indexes.primary];
          const [pkCheck] = await this.pool.query(`SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`);
          const existingPk = pkCheck.map((p) => p.Column_name);
          if (primaryKeys.join(",") !== existingPk.join(",")) {
            logger.info(`Altering table "${tableName}" primary key`);
            await this.run(`ALTER TABLE \`${tableName}\` DROP PRIMARY KEY, ADD PRIMARY KEY (${primaryKeys.map((k) => `\`${k}\``).join(",")})`);
          }
        }
        if (indexes.unique) {
          const uniqueKeys = Array.isArray(indexes.unique[0]) ? indexes.unique : indexes.unique.map((k) => Array.isArray(k) ? k : [k]);
          for (const keys of uniqueKeys) {
            const name = keys.join("_") + "_uniq";
            const existing = indexMap[name] || [];
            if (existing.join(",") !== keys.join(",")) {
              if (existing.length) {
                await this.run(`ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``);
              }
              await this.run(`ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`${name}\` (${keys.map((k) => `\`${k}\``).join(",")})`);
            }
          }
        }
      }
    }
  }
  async create(table, data) {
    const tableName = table;
    const keys = Object.keys(data).map((k) => `\`${k}\``).join(", ");
    const placeholders = Object.keys(data).map(() => "?").join(", ");
    const sql = `INSERT INTO ${tableName} (${keys}) VALUES (${placeholders})`;
    const result = await this.run(sql, Object.values(data));
    return { ...data, id: result.insertId };
  }
  async select(table, query, fields) {
    const tableName = table;
    const { sql: whereSql, params } = buildWhereClause(query);
    const selectFields = fields ? fields.map((f) => `\`${f}\``).join(", ") : "*";
    const sql = `SELECT ${selectFields} FROM ${tableName}${whereSql ? ` WHERE ${whereSql}` : ""}`;
    return this.all(sql, params);
  }
  async selectOne(table, query, fields) {
    const tableName = table;
    const { sql: whereSql, params } = buildWhereClause(query);
    const selectFields = fields ? fields.map((f) => `\`${f}\``).join(", ") : "*";
    const sql = `SELECT ${selectFields} FROM ${tableName}${whereSql ? ` WHERE ${whereSql}` : ""} LIMIT 1`;
    return this.get(sql, params);
  }
  async update(table, query, data) {
    const tableName = table;
    const { sql: whereSql, params: whereParams } = buildWhereClause(query);
    const setParts = [];
    const setParams = [];
    for (const key in data) {
      const value = data[key];
      if (typeof value === "object" && value !== null && "$inc" in value) {
        setParts.push(`\`${key}\` = \`${key}\` + ?`);
        setParams.push(value.$inc);
      } else {
        setParts.push(`\`${key}\` = ?`);
        setParams.push(value);
      }
    }
    if (setParts.length === 0) return 0;
    const sql = `UPDATE ${tableName} SET ${setParts.join(", ")}${whereSql ? ` WHERE ${whereSql}` : ""}`;
    const result = await this.run(sql, [...setParams, ...whereParams]);
    return result.affectedRows ?? 0;
  }
  async remove(table, query) {
    const tableName = table;
    const { sql: whereSql, params } = buildWhereClause(query);
    const sql = `DELETE FROM ${tableName}${whereSql ? ` WHERE ${whereSql}` : ""}`;
    const result = await this.run(sql, params);
    return result.affectedRows ?? 0;
  }
  async upsert(table, data, key, update) {
    const tableName = table;
    if (data.length === 0) return;
    const insertKeys = Object.keys(data[0]);
    const updatePayload = update ?? data[0];
    const updateParts = [];
    for (const key2 in updatePayload) {
      const value = updatePayload[key2];
      if (typeof value === "object" && value !== null && "$inc" in value) {
        updateParts.push(`\`${key2}\` = \`${key2}\` + ${this.pool.escape(value.$inc)}`);
      } else {
        updateParts.push(`\`${key2}\` = VALUES(\`${key2}\`)`);
      }
    }
    const sql = `
            INSERT INTO ${tableName} (${insertKeys.map((k) => `\`${k}\``).join(", ")})
            VALUES ${data.map((item) => `(${insertKeys.map((k) => this.pool.escape(item[k])).join(", ")})`).join(", ")}
            ON DUPLICATE KEY UPDATE ${updateParts.join(", ")}
        `;
    await this.run(sql);
  }
  async drop(table) {
    await this.run(`DROP TABLE IF EXISTS ${table}`);
  }
  async run(sql, params) {
    const [result] = await this.pool.execute(sql, params);
    return result;
  }
  async get(sql, params) {
    const [rows] = await this.pool.execute(sql, params);
    return rows[0];
  }
  async all(sql, params) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }
  async close() {
    await this.pool.end();
    logger.info("MySQL connection pool closed.");
  }
};
var config = Schema.object({
  host: Schema.string("MySQL \u4E3B\u673A\u540D").default("localhost"),
  port: Schema.number("MySQL \u7AEF\u53E3").default(3306),
  user: Schema.string("\u7528\u6237\u540D").required(),
  password: Schema.string("\u5BC6\u7801").required(),
  database: Schema.string("\u6570\u636E\u5E93\u540D").required(),
  connectionLimit: Schema.number("\u8FDE\u63A5\u6C60\u5927\u5C0F").default(10),
  charset: Schema.string("\u5B57\u7B26\u96C6").default("utf8mb4")
});
async function apply(ctx, config2) {
  if (!config2.user || !config2.password || !config2.database) {
    logger.error("MySQL plugin is not configured correctly. Please provide user, password, and database.");
    return;
  }
  try {
    const db = await MysqlDatabase.create(config2);
    ctx.registerComponent("database", db);
  } catch (error) {
    logger.error("Failed to connect to MySQL database:", error);
  }
}
async function disable(ctx) {
  const db = ctx.getComponent("database");
  if (db) {
    await db.close();
  }
}
export {
  apply,
  config,
  disable,
  provide
};
