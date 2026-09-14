import { Context, Logger, Schema, Database } from 'yumeri'
import * as crypto from 'crypto'

const logger = new Logger('user')

export const depend = ['database']
export const provide = ['user']
export const usage = '提供 Yumeri 用户模型'

interface UserTable {
  id: number
  username: string
  password: string
  email?: string | null
  phone?: string | null
  createAt: Date
  updateAt: Date
}

declare module 'yumeri' {
  interface Tables {
    user: UserTable
  }
  interface Components {
    user: User
  }
}

export interface UserConfig {
  name: string;
  isEmailopen: boolean;
  isPhoneopen: boolean;
  encryptType: string;
}

export const config: Schema<UserConfig> = Schema.object({
  name: Schema.string('用户数据表名').key('user.config.name').default('user'),
  isEmailopen: Schema.boolean('是否开启邮箱字段').key('user.config.isEmailopen').default(true),
  isPhoneopen: Schema.boolean('是否开启手机号字段').key('user.config.isPhoneopen').default(true),
  encryptType: Schema.string('密码加密方式').key('user.config.encryptType').default('md5'),
});

/** 插件配置项说明的翻译表 */
const configI18n = {
  'user.config.name': { zh: '用户数据表名', en: 'User table name' },
  'user.config.isEmailopen': { zh: '是否开启邮箱字段', en: 'Enable the email field' },
  'user.config.isPhoneopen': { zh: '是否开启手机号字段', en: 'Enable the phone field' },
  'user.config.encryptType': { zh: '密码加密方式', en: 'Password encryption method' },
};

export class User {
  private tableName: string

  constructor(private db: Database, private config: UserConfig) {
    this.tableName = this.config.name
  }

  private hashPassword(password: string): string {
    return crypto.createHash(this.config.encryptType).update(password).digest('hex')
  }

  async getuserinfo(username: string) {
    return this.db.selectOne('user', { username }, ['id', 'username', 'email', 'phone', 'createAt', 'updateAt'])
  }

  async getuserinfobyid(id: number) {
    return this.db.selectOne('user', { id }, ['id', 'username', 'email', 'phone', 'createAt', 'updateAt'])
  }

  async updateuserinfo(id: number, data: Partial<UserTable>) {
    return this.db.update('user', { id }, data)
  }

  async changepassword(username: string, password: string) {
    const hashedPassword = this.hashPassword(password)
    return this.db.update('user', { username }, { password: hashedPassword })
  }

  async register(username: string, password: string, email?: string, phone?: string) {
    const hashedPassword = this.hashPassword(password)
    const data: Partial<UserTable> = {
      username,
      password: hashedPassword,
      email: this.config.isEmailopen ? email ?? null : null,
      phone: this.config.isPhoneopen ? phone ?? null : null,
      createAt: new Date(),
      updateAt: new Date()
    }
    try {
      const result = this.db.create('user', data)
      return result
    } catch (error) {
      return false
    }
  }

  async login(username: string, password: string): Promise<boolean> {
    const hashedPassword = this.hashPassword(password)
    const result = await this.db.selectOne('user', { username, password: hashedPassword })
    return !!result
  }
}

export async function apply(ctx: Context, config: UserConfig) {
  ctx.i18n(configI18n);
  const db = ctx.component.database;

  const schema: Record<string, any> = {
    id: { type: 'unsigned', autoIncrement: true },
    username: 'string',
    password: 'string',
    createAt: 'date',
    updateAt: 'date'
  }

  if (config.isEmailopen) schema.email = 'string'
  if (config.isPhoneopen) schema.phone = 'string'

  db.extend('user', schema, {
    primary: 'id',
    autoInc: true,
    unique: ['username']
  })

  ctx.registerComponent('user', new User(db, config))
  logger.info('User model loaded')
}