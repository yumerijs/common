"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.provide = void 0;
exports.apply = apply;
exports.disable = disable;
const yumeri_1 = require("yumeri");
const promise_1 = __importDefault(require("mysql2/promise"));
const logger = new yumeri_1.Logger("mysql");
exports.provide = ['database'];
// --- Query Builder (reused from sqlite implementation) ---
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
        if (value === undefined || value === null)
            continue;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some(k => k.startsWith('$'))) {
            const operatorKeys = Object.keys(value);
            for (const op of operatorKeys) {
                const opValue = value[op];
                if (opValue === undefined || opValue === null)
                    continue; // 同样跳过
                switch (op) {
                    case '$eq':
                        conditions.push(`\`${key}\` = ?`);
                        params.push(opValue);
                        break;
                    case '$ne':
                        conditions.push(`\`${key}\` != ?`);
                        params.push(opValue);
                        break;
                    case '$gt':
                        conditions.push(`\`${key}\` > ?`);
                        params.push(opValue);
                        break;
                    case '$gte':
                        conditions.push(`\`${key}\` >= ?`);
                        params.push(opValue);
                        break;
                    case '$lt':
                        conditions.push(`\`${key}\` < ?`);
                        params.push(opValue);
                        break;
                    case '$lte':
                        conditions.push(`\`${key}\` <= ?`);
                        params.push(opValue);
                        break;
                    case '$in':
                        if (Array.isArray(opValue) && opValue.length > 0) {
                            conditions.push(`\`${key}\` IN (${opValue.map(() => '?').join(',')})`);
                            params.push(...opValue);
                        }
                        break;
                    case '$nin':
                        if (Array.isArray(opValue) && opValue.length > 0) {
                            conditions.push(`\`${key}\` NOT IN (${opValue.map(() => '?').join(',')})`);
                            params.push(...opValue);
                        }
                        break;
                }
            }
        }
        else {
            conditions.push(`\`${key}\` = ?`);
            params.push(value);
        }
    }
    return { sql: conditions.join(' AND '), params };
}
// --- Database Implementation ---
class MysqlDatabase {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    static async create(options) {
        const pool = promise_1.default.createPool(options);
        // Test connection
        const conn = await pool.getConnection();
        conn.release();
        logger.info('MySQL database connection test successful.');
        return new MysqlDatabase(pool);
    }
    getFieldDef(def) {
        return typeof def === 'string' ? { type: def } : def;
    }
    mapTypeToSql(def) {
        const type = def.type.toUpperCase();
        switch (type) {
            case 'STRING': return `VARCHAR(${def.length || 255})`;
            case 'TEXT': return 'TEXT';
            case 'JSON': return 'JSON';
            case 'INTEGER': return 'INT';
            case 'UNSIGNED': return 'INT UNSIGNED';
            case 'BIGINT': return 'BIGINT';
            case 'FLOAT': return 'FLOAT';
            case 'DOUBLE': return 'DOUBLE';
            case 'DECIMAL': return `DECIMAL(${def.precision || 10}, ${def.scale || 2})`;
            case 'BOOLEAN': return 'TINYINT(1)';
            case 'DATE': return 'DATE';
            case 'TIME': return 'TIME';
            case 'TIMESTAMP': return 'TIMESTAMP';
            case 'DATETIME': return 'DATETIME';
            default: return type;
        }
    }
    buildColumnSql(field, def) {
        let sql = `\`${field}\` ${this.mapTypeToSql(def)}`;
        if (def.nullable === false)
            sql += ' NOT NULL';
        if (def.initial !== undefined)
            sql += ` DEFAULT ${this.pool.escape(def.initial)}`;
        if (def.autoIncrement)
            sql += ' AUTO_INCREMENT';
        return sql;
    }
    async extend(table, schema, indexes) {
        const tableName = table;
        const [rows] = await this.pool.query('SHOW TABLES LIKE ?', [tableName]);
        const tableExists = rows.length > 0;
        if (!tableExists) {
            // 表不存在，直接创建
            const fields = Object.keys(schema);
            const columns = fields.map(field => this.buildColumnSql(field, this.getFieldDef(schema[field])));
            // 主键
            if (indexes?.primary) {
                const primaryKeys = (Array.isArray(indexes.primary) ? indexes.primary : [indexes.primary]);
                columns.push(`PRIMARY KEY (${primaryKeys.map(k => `\`${k}\``).join(', ')})`);
            }
            // 唯一索引
            if (indexes?.unique) {
                const uniqueKeys = Array.isArray(indexes.unique[0])
                    ? indexes.unique
                    : indexes.unique.map(k => Array.isArray(k) ? k : [k]);
                uniqueKeys.forEach(keys => {
                    columns.push(`UNIQUE KEY (${keys.map(k => `\`${k}\``).join(', ')})`);
                });
            }
            const sql = `CREATE TABLE \`${tableName}\` (${columns.join(', ')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
            logger.info(`Creating table "${tableName}"`);
            await this.run(sql);
        }
        else {
            // 表存在，检查字段和索引
            const [existingCols] = await this.pool.query(`DESCRIBE \`${tableName}\``);
            const existingColNames = existingCols.map(c => c.Field);
            const alterClauses = [];
            // 新字段或类型修改
            for (const field of Object.keys(schema)) {
                const def = this.getFieldDef(schema[field]);
                if (!existingColNames.includes(field)) {
                    alterClauses.push(`ADD COLUMN ${this.buildColumnSql(field, def)}`);
                }
                else {
                    // 字段已存在，检查类型/默认值是否一致
                    const col = existingCols.find(c => c.Field === field);
                    const newColSql = this.buildColumnSql(field, def);
                    if (!newColSql.includes(col.Type)) {
                        alterClauses.push(`MODIFY COLUMN ${newColSql}`);
                    }
                }
            }
            if (alterClauses.length > 0) {
                await this.run(`ALTER TABLE \`${tableName}\` ${alterClauses.join(', ')}`);
            }
            // 索引更新
            if (indexes) {
                const [existingIndexes] = await this.pool.query(`SHOW INDEX FROM \`${tableName}\``);
                const indexMap = {};
                existingIndexes.forEach(idx => {
                    if (idx.Key_name !== 'PRIMARY') {
                        if (!indexMap[idx.Key_name])
                            indexMap[idx.Key_name] = [];
                        indexMap[idx.Key_name].push(idx.Column_name);
                    }
                });
                // 主键
                if (indexes.primary) {
                    const primaryKeys = (Array.isArray(indexes.primary) ? indexes.primary : [indexes.primary]);
                    const [pkCheck] = await this.pool.query(`SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`);
                    const existingPk = pkCheck.map(p => p.Column_name);
                    if (primaryKeys.join(',') !== existingPk.join(',')) {
                        logger.info(`Altering table "${tableName}" primary key`);
                        await this.run(`ALTER TABLE \`${tableName}\` DROP PRIMARY KEY, ADD PRIMARY KEY (${primaryKeys.map(k => `\`${k}\``).join(',')})`);
                    }
                }
                // 唯一索引
                if (indexes.unique) {
                    const uniqueKeys = Array.isArray(indexes.unique[0])
                        ? indexes.unique
                        : indexes.unique.map(k => Array.isArray(k) ? k : [k]);
                    for (const keys of uniqueKeys) {
                        const name = keys.join('_') + '_uniq';
                        const existing = indexMap[name] || [];
                        if (existing.join(',') !== keys.join(',')) {
                            // 删除旧索引再建新索引
                            if (existing.length) {
                                await this.run(`ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``);
                            }
                            await this.run(`ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`${name}\` (${keys.map(k => `\`${k}\``).join(',')})`);
                        }
                    }
                }
            }
        }
    }
    async create(table, data) {
        const tableName = table;
        const keys = Object.keys(data).map(k => `\`${k}\``).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const sql = `INSERT INTO ${tableName} (${keys}) VALUES (${placeholders})`;
        const result = await this.run(sql, Object.values(data));
        return { ...data, id: result.insertId };
    }
    async select(table, query, fields) {
        const tableName = table;
        const { sql: whereSql, params } = buildWhereClause(query);
        const selectFields = fields ? fields.map(f => `\`${f}\``).join(', ') : '*';
        const sql = `SELECT ${selectFields} FROM ${tableName}${whereSql ? ` WHERE ${whereSql}` : ''}`;
        return this.all(sql, params);
    }
    async selectOne(table, query, fields) {
        const tableName = table;
        const { sql: whereSql, params } = buildWhereClause(query);
        const selectFields = fields ? fields.map(f => `\`${f}\``).join(', ') : '*';
        const sql = `SELECT ${selectFields} FROM ${tableName}${whereSql ? ` WHERE ${whereSql}` : ''} LIMIT 1`;
        return this.get(sql, params);
    }
    async update(table, query, data) {
        const tableName = table;
        const { sql: whereSql, params: whereParams } = buildWhereClause(query);
        const setParts = [];
        const setParams = [];
        for (const key in data) {
            const value = data[key];
            if (typeof value === 'object' && value !== null && '$inc' in value) {
                setParts.push(`\`${key}\` = \`${key}\` + ?`);
                setParams.push(value.$inc);
            }
            else {
                setParts.push(`\`${key}\` = ?`);
                setParams.push(value);
            }
        }
        if (setParts.length === 0)
            return 0;
        const sql = `UPDATE ${tableName} SET ${setParts.join(', ')}${whereSql ? ` WHERE ${whereSql}` : ''}`;
        const result = await this.run(sql, [...setParams, ...whereParams]);
        return result.affectedRows ?? 0;
    }
    async remove(table, query) {
        const tableName = table;
        const { sql: whereSql, params } = buildWhereClause(query);
        const sql = `DELETE FROM ${tableName}${whereSql ? ` WHERE ${whereSql}` : ''}`;
        const result = await this.run(sql, params);
        return result.affectedRows ?? 0;
    }
    async upsert(table, data, key, update) {
        const tableName = table;
        if (data.length === 0)
            return;
        const insertKeys = Object.keys(data[0]);
        const updatePayload = update ?? data[0];
        const updateParts = [];
        for (const key in updatePayload) {
            const value = updatePayload[key];
            if (typeof value === 'object' && value !== null && '$inc' in value) {
                updateParts.push(`\`${key}\` = \`${key}\` + ${this.pool.escape(value.$inc)}`);
            }
            else {
                updateParts.push(`\`${key}\` = VALUES(\`${key}\`)`);
            }
        }
        const sql = `
            INSERT INTO ${tableName} (${insertKeys.map(k => `\`${k}\``).join(', ')})
            VALUES ${data.map(item => `(${insertKeys.map(k => this.pool.escape(item[k])).join(', ')})`).join(', ')}
            ON DUPLICATE KEY UPDATE ${updateParts.join(', ')}
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
        logger.info('MySQL connection pool closed.');
    }
}
// --- Plugin Definition ---
exports.config = {
    schema: {
        host: { type: 'string', default: 'localhost', description: 'MySQL 主机名' },
        port: { type: 'number', default: 3306, description: 'MySQL 端口' },
        user: { type: 'string', required: true, description: '用户名' },
        password: { type: 'string', required: true, description: '密码' },
        database: { type: 'string', required: true, description: '数据库名' },
        connectionLimit: { type: 'number', default: 10, description: '连接池大小' },
        charset: { type: 'string', default: 'utf8mb4', description: '字符集', enum: ['utf8', 'utf8mb4'] },
    }
};
async function apply(ctx, config) {
    const options = {
        host: config.get('host'),
        port: config.get('port'),
        user: config.get('user'),
        password: config.get('password'),
        database: config.get('database'),
        connectionLimit: config.get('connectionLimit'),
        charset: config.get('charset'),
    };
    if (!options.user || !options.password || !options.database) {
        logger.error('MySQL plugin is not configured correctly. Please provide user, password, and database.');
        return;
    }
    try {
        const db = await MysqlDatabase.create(options);
        ctx.registerComponent('database', db);
    }
    catch (error) {
        logger.error('Failed to connect to MySQL database:', error);
    }
}
async function disable(ctx) {
    const db = ctx.getComponent('database');
    await db.close();
}
