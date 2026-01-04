// src/index.ts
import { Logger, Schema } from "yumeri";
import * as crypto from "crypto";
var logger = new Logger("user");
var depend = ["database"];
var provide = ["user"];
var usage = "\u63D0\u4F9B Yumeri \u7528\u6237\u6A21\u578B";
var config = Schema.object({
  name: Schema.string("\u7528\u6237\u6570\u636E\u8868\u540D").default("user"),
  isEmailopen: Schema.boolean("\u662F\u5426\u5F00\u542F\u90AE\u7BB1\u5B57\u6BB5").default(true),
  isPhoneopen: Schema.boolean("\u662F\u5426\u5F00\u542F\u624B\u673A\u53F7\u5B57\u6BB5").default(true),
  encryptType: Schema.string("\u5BC6\u7801\u52A0\u5BC6\u65B9\u5F0F").default("md5")
});
var User = class {
  constructor(db, config2) {
    this.db = db;
    this.config = config2;
    this.tableName = this.config.name;
  }
  tableName;
  hashPassword(password) {
    return crypto.createHash(this.config.encryptType).update(password).digest("hex");
  }
  async getuserinfo(username) {
    return this.db.selectOne("user", { username }, ["id", "username", "email", "phone", "createAt", "updateAt"]);
  }
  async getuserinfobyid(id) {
    return this.db.selectOne("user", { id }, ["id", "username", "email", "phone", "createAt", "updateAt"]);
  }
  async updateuserinfo(id, data) {
    return this.db.update("user", { id }, data);
  }
  async changepassword(username, password) {
    const hashedPassword = this.hashPassword(password);
    return this.db.update("user", { username }, { password: hashedPassword });
  }
  async register(username, password, email, phone) {
    const hashedPassword = this.hashPassword(password);
    const data = {
      username,
      password: hashedPassword,
      email: this.config.isEmailopen ? email ?? null : null,
      phone: this.config.isPhoneopen ? phone ?? null : null,
      createAt: /* @__PURE__ */ new Date(),
      updateAt: /* @__PURE__ */ new Date()
    };
    try {
      const result = this.db.create("user", data);
      return result;
    } catch (error) {
      return false;
    }
  }
  async login(username, password) {
    const hashedPassword = this.hashPassword(password);
    const result = await this.db.selectOne("user", { username, password: hashedPassword });
    return !!result;
  }
};
async function apply(ctx, config2) {
  const db = ctx.component.database;
  const schema = {
    id: { type: "unsigned", autoIncrement: true },
    username: "string",
    password: "string",
    createAt: "date",
    updateAt: "date"
  };
  if (config2.isEmailopen) schema.email = "string";
  if (config2.isPhoneopen) schema.phone = "string";
  db.extend("user", schema, {
    primary: "id",
    autoInc: true,
    unique: ["username"]
  });
  ctx.registerComponent("user", new User(db, config2));
  logger.info("User model loaded");
}
export {
  User,
  apply,
  config,
  depend,
  provide,
  usage
};
