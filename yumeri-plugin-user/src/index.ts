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
  name: Schema.string('用户数据表名').default('user'),
  isEmailopen: Schema.boolean('是否开启邮箱字段').default(true),
  isPhoneopen: Schema.boolean('是否开启手机号字段').default(true),
  encryptType: Schema.string('密码加密方式').default('md5'),
});

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