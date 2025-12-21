"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.provide = void 0;
exports.apply = apply;
exports.disable = disable;
const yumeri_1 = require("yumeri");
const sqlite_1 = require("sqlite");
const sqlite3_1 = require("sqlite3");
const path = __importStar(require("path"));
const logger = new yumeri_1.Logger("sqlite");
exports.provide = ['database'];
// --- Query Builder --- 
function buildWhereClause(query) {
    const conditions = [];
    const params = [];
    for (const key in query) {
        if (key === '$or' || key === '$and') {
            const subQueries = query[key];
            const subResults = subQueries.map(buildWhereClause).filter(r => r.sql);
            if (subResults.length > 0) {
                const operator = key === '$or' ? ' OR ' : ' AND ';
                conditions.push(`(${subResults.map(r => r.sql).join(operator)})`);
                params.push(...subResults.flatMap(r => r.params));
            }
            continue;
        }
        const value = query[key];
        // 💡 新增：跳过 undefined / null 的字段
        if (value === undefined || value === null)
            continue;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some(k => k.startsWith('$'))) {
            const operatorKeys = Object.keys(value);
            for (const op of operatorKeys) {
                const opValue = value[op];
                if (opValue === undefined || opValue === null)
                    continue; // 同样过滤空值
                switch (op) {
                    case '$eq':
                        conditions.push(`"${key}" = ?`);
                        params.push(opValue);
                        break;
                    case '$ne':
                        conditions.push(`"${key}" != ?`);
                        params.push(opValue);
                        break;
                    case '$gt':
                        conditions.push(`"${key}" > ?`);
                        params.push(opValue);
                        break;
                    case '$gte':
                        conditions.push(`"${key}" >= ?`);
                        params.push(opValue);
                        break;
                    case '$lt':
                        conditions.push(`"${key}" < ?`);
                        params.push(opValue);
                        break;
                    case '$lte':
                        conditions.push(`"${key}" <= ?`);
                        params.push(opValue);
                        break;
                    case '$in':
                        if (Array.isArray(opValue) && opValue.length > 0) {
                            conditions.push(`"${key}" IN (${opValue.map(() => '?').join(',')})`);
                            params.push(...opValue);
                        }
                        break;
                    case '$nin':
                        if (Array.isArray(opValue) && opValue.length > 0) {
                            conditions.push(`"${key}" NOT IN (${opValue.map(() => '?').join(',')})`);
                            params.push(...opValue);
                        }
                        break;
                }
            }
        }
        else {
            conditions.push(`"${key}" = ?`);
            params.push(value);
        }
    }
    return { sql: conditions.join(' AND '), params };
}
// --- Database Implementation ---
class SqliteDatabase {
    driver;
    constructor(driver) {
        this.driver = driver;
    }
    static async create(dbPath) {
        const driver = await (0, sqlite_1.open)({ filename: dbPath, driver: sqlite3_1.Database });
        logger.info(`Successfully connected to SQLite database at ${dbPath}`);
        return new SqliteDatabase(driver);
    }
    getFieldDef(def) {
        return typeof def === 'string' ? { type: def } : def;
    }
    mapTypeToSql(type) {
        const typeMap = {
            string: 'TEXT', text: 'TEXT', json: 'TEXT',
            integer: 'INTEGER', unsigned: 'INTEGER UNSIGNED', bigint: 'BIGINT',
            float: 'REAL', double: 'REAL', decimal: 'REAL',
            boolean: 'INTEGER',
            date: 'TEXT', time: 'TEXT', timestamp: 'DATETIME',
        };
        return typeMap[type] || 'TEXT';
    }
    buildColumnSql(field, def) {
        let sql = `"${field}" ${this.mapTypeToSql(def.type)}`;
        if (def.nullable === false)
            sql += ' NOT NULL';
        if (def.initial !== undefined)
            sql += ` DEFAULT ${JSON.stringify(def.initial)}`;
        if (def.autoIncrement)
            sql += ' PRIMARY KEY AUTOINCREMENT'; // SQLite 自增
        return sql;
    }
    async extend(table, schema, indexes) {
        const tableName = table;
        const existingCols = await this.driver.all(`PRAGMA table_info("${tableName}")`).catch(() => []);
        if (existingCols.length === 0) {
            // 表不存在，创建
            const fields = Object.keys(schema);
            const columns = fields.map(field => this.buildColumnSql(field, this.getFieldDef(schema[field])));
            let sql = `CREATE TABLE "${tableName}" (${columns.join(', ')})`;
            logger.info(`Creating table "${tableName}"`);
            await this.run(sql);
        }
        else {
            // 表存在，检查新增字段
            for (const field of Object.keys(schema)) {
                if (!existingCols.some(col => col.name === field)) {
                    const colSql = this.buildColumnSql(field, this.getFieldDef(schema[field]));
                    logger.info(`Adding column "${tableName}"."${field}"`);
                    await this.run(`ALTER TABLE "${tableName}" ADD COLUMN ${colSql}`);
                }
            }
        }
    }
    async create(table, data) {
        const tableName = table;
        const keys = Object.keys(data).map(k => `"${k}"`).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const sql = `INSERT INTO "${tableName}" (${keys}) VALUES (${placeholders})`;
        const result = await this.run(sql, Object.values(data));
        return { ...data, id: result.lastID };
    }
    async select(table, query, fields) {
        const tableName = table;
        const { sql: whereSql, params } = buildWhereClause(query);
        const selectFields = fields ? fields.map(f => `"${f}"`).join(', ') : '*';
        const sql = `SELECT ${selectFields} FROM "${tableName}"${whereSql ? ` WHERE ${whereSql}` : ''}`;
        logger.info(sql, params);
        return this.all(sql, params);
    }
    async selectOne(table, query, fields) {
        const tableName = table;
        const { sql: whereSql, params } = buildWhereClause(query);
        const selectFields = fields ? fields.map(f => `\"${f}\"`).join(', ') : '*';
        const sql = `SELECT ${selectFields} FROM \"${tableName}\"${whereSql ? ` WHERE ${whereSql}` : ''} LIMIT 1`;
        return this.get(sql, params);
    }
    async update(table, query, data) {
        const tableName = table;
        const { sql: whereSql, params: whereParams } = buildWhereClause(query);
        const setKeys = Object.keys(data);
        const setSql = setKeys.map(key => `"${key}" = ?`).join(', ');
        const setParams = Object.values(data);
        const sql = `UPDATE "${tableName}" SET ${setSql}${whereSql ? ` WHERE ${whereSql}` : ''}`;
        const result = await this.run(sql, [...setParams, ...whereParams]);
        return result.changes ?? 0;
    }
    async remove(table, query) {
        const tableName = table;
        const { sql: whereSql, params } = buildWhereClause(query);
        const sql = `DELETE FROM "${tableName}"${whereSql ? ` WHERE ${whereSql}` : ''}`;
        const result = await this.run(sql, params);
        return result.changes ?? 0;
    }
    async upsert(table, data, key) {
        const tableName = table;
        const keys = Object.keys(data[0]);
        const conflictKeys = (Array.isArray(key) ? key : [key]);
        const updateKeys = keys.filter(k => !conflictKeys.includes(k));
        const sql = `
            INSERT INTO "${tableName}" (${keys.map(k => `"${k}"`).join(', ')})
            VALUES (${keys.map(() => '?').join(', ')})
            ON CONFLICT (${conflictKeys.map(k => `"${k}"`).join(', ')}) DO UPDATE SET
            ${updateKeys.map(k => `"${k}" = excluded."${k}"`).join(', ')}
        `;
        await this.driver.exec('BEGIN');
        try {
            const stmt = await this.driver.prepare(sql);
            for (const item of data) {
                await stmt.run(keys.map(k => item[k]));
            }
            await stmt.finalize();
            await this.driver.exec('COMMIT');
        }
        catch (e) {
            await this.driver.exec('ROLLBACK');
            throw e;
        }
    }
    async drop(table) {
        await this.run(`DROP TABLE IF EXISTS "${table}"`);
    }
    run(sql, params) { return this.driver.run(sql, params); }
    get(sql, params) { return this.driver.get(sql, params); }
    all(sql, params) { return this.driver.all(sql, params); }
    async close() {
        if (this.driver) {
            await this.driver.close();
            logger.info('Database connection closed.');
        }
    }
}
exports.config = yumeri_1.Schema.object({
    path: yumeri_1.Schema.string('数据库文件地址').default('data/database.db'),
});
async function apply(ctx, config) {
    const dbPath = path.join(process.cwd(), config.path);
    const db = await SqliteDatabase.create(dbPath);
    ctx.registerComponent('database', db);
}
async function disable(ctx) {
    const db = ctx.getComponent('database');
    await db.close();
}
