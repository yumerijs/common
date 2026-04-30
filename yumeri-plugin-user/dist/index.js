import { Logger, Schema } from 'yumeri';
import * as crypto from 'crypto';
const logger = new Logger('user');
export const depend = ['database'];
export const provide = ['user'];
export const usage = '提供 Yumeri 用户模型';
export const config = Schema.object({
    name: Schema.string('用户数据表名').default('user'),
    isEmailopen: Schema.boolean('是否开启邮箱字段').default(true),
    isPhoneopen: Schema.boolean('是否开启手机号字段').default(true),
    encryptType: Schema.string('密码加密方式').default('md5'),
});
export class User {
    db;
    config;
    tableName;
    constructor(db, config) {
        this.db = db;
        this.config = config;
        this.tableName = this.config.name;
    }
    hashPassword(password) {
        return crypto.createHash(this.config.encryptType).update(password).digest('hex');
    }
    async getuserinfo(username) {
        return this.db.selectOne('user', { username }, ['id', 'username', 'email', 'phone', 'createAt', 'updateAt']);
    }
    async getuserinfobyid(id) {
        return this.db.selectOne('user', { id }, ['id', 'username', 'email', 'phone', 'createAt', 'updateAt']);
    }
    async updateuserinfo(id, data) {
        return this.db.update('user', { id }, data);
    }
    async changepassword(username, password) {
        const hashedPassword = this.hashPassword(password);
        return this.db.update('user', { username }, { password: hashedPassword });
    }
    async register(username, password, email, phone) {
        const hashedPassword = this.hashPassword(password);
        const data = {
            username,
            password: hashedPassword,
            email: this.config.isEmailopen ? email ?? null : null,
            phone: this.config.isPhoneopen ? phone ?? null : null,
            createAt: new Date(),
            updateAt: new Date()
        };
        try {
            const result = this.db.create('user', data);
            return result;
        }
        catch (error) {
            return false;
        }
    }
    async login(username, password) {
        const hashedPassword = this.hashPassword(password);
        const result = await this.db.selectOne('user', { username, password: hashedPassword });
        return !!result;
    }
}
export async function apply(ctx, config) {
    const db = ctx.component.database;
    const schema = {
        id: { type: 'unsigned', autoIncrement: true },
        username: 'string',
        password: 'string',
        createAt: 'date',
        updateAt: 'date'
    };
    if (config.isEmailopen)
        schema.email = 'string';
    if (config.isPhoneopen)
        schema.phone = 'string';
    db.extend('user', schema, {
        primary: 'id',
        autoInc: true,
        unique: ['username']
    });
    ctx.registerComponent('user', new User(db, config));
    logger.info('User model loaded');
}
