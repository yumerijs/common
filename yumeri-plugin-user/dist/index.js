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
exports.User = exports.config = exports.usage = exports.provide = exports.depend = void 0;
exports.apply = apply;
const yumeri_1 = require("yumeri");
const crypto = __importStar(require("crypto"));
const logger = new yumeri_1.Logger('user');
exports.depend = ['database'];
exports.provide = ['user'];
exports.usage = '提供 Yumeri 用户模型';
exports.config = yumeri_1.Schema.object({
    name: yumeri_1.Schema.string('用户数据表名').default('user'),
    isEmailopen: yumeri_1.Schema.boolean('是否开启邮箱字段').default(true),
    isPhoneopen: yumeri_1.Schema.boolean('是否开启手机号字段').default(true),
    encryptType: yumeri_1.Schema.string('密码加密方式').default('md5'),
});
class User {
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
exports.User = User;
async function apply(ctx, config) {
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
