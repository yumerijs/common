"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// common/yumeri-plugin-permission/src/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  config: () => config2,
  depend: () => depend,
  provide: () => provide,
  usage: () => usage
});
module.exports = __toCommonJS(index_exports);
var import_yumeri2 = require("yumeri");

// common/yumeri-plugin-user/dist/index.js
var import_yumeri = require("yumeri");
var logger = new import_yumeri.Logger("user");
var config = import_yumeri.Schema.object({
  name: import_yumeri.Schema.string("\u7528\u6237\u6570\u636E\u8868\u540D").default("user"),
  isEmailopen: import_yumeri.Schema.boolean("\u662F\u5426\u5F00\u542F\u90AE\u7BB1\u5B57\u6BB5").default(true),
  isPhoneopen: import_yumeri.Schema.boolean("\u662F\u5426\u5F00\u542F\u624B\u673A\u53F7\u5B57\u6BB5").default(true),
  encryptType: import_yumeri.Schema.string("\u5BC6\u7801\u52A0\u5BC6\u65B9\u5F0F").default("md5")
});

// common/yumeri-plugin-permission/src/index.ts
var logger2 = new import_yumeri2.Logger("permission");
var depend = ["database", "user"];
var usage = `\u7528\u6237\u6743\u9650\u6A21\u578B<br>\u4F9D\u8D56\u4E8Eyumeri-plugin-user\uFF08\u7528\u6237\u6A21\u578B\uFF09<br>\u8D85\u7BA1\u6743\u9650\u5927\u5C0F\u4E3A10`;
var provide = ["permission"];
var config2 = import_yumeri2.Schema.object({
  defaultpermit: import_yumeri2.Schema.number("\u9ED8\u8BA4\u6743\u9650").default(1).required()
});
async function apply(ctx, config3) {
  const db = ctx.component.database;
  await db.extend("permission", {
    id: { type: "unsigned", nullable: false },
    permit: { type: "unsigned", initial: config3.defaultpermit }
  }, { primary: "id" });
  ctx.registerComponent("permission", {
    async getPermit(id) {
      const result = await db.selectOne("permission", { id });
      if (result) {
        return result.permit;
      } else {
        await db.create("permission", {
          id,
          permit: config3.defaultpermit
        });
        return config3.defaultpermit;
      }
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  apply,
  config,
  depend,
  provide,
  usage
});
