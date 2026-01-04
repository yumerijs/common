// src/index.ts
import { Logger, Schema } from "yumeri";
import * as path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "yumeri-plugin-user";
var logger = new Logger("authority");
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var depend = ["user"];
var provide = ["authority"];
var usage = `\u7528\u6237\u767B\u9646\u9A8C\u8BC1\u670D\u52A1<br>\u4F9D\u8D56\u4E8Eyumeri-plugin-user\uFF08\u7528\u6237\u6A21\u578B\uFF09`;
var config = Schema.object({
  template: Schema.object({
    loginpath: Schema.string("\u767B\u5F55\u9875\u6A21\u677F\u5730\u5740").default("../static/login.html"),
    regpath: Schema.string("\u6CE8\u518C\u9875\u6A21\u677F\u5730\u5740").default("../static/reg.html")
  }, "HTML\u6A21\u677F\u914D\u7F6E")
});
function resolvePath(inputPath, currentFileDirectory) {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  } else {
    return path.resolve(currentFileDirectory, inputPath);
  }
}
async function getHook(ctx, hookname, originString) {
  const result = await ctx.executeHook(hookname);
  let item = "";
  if (result) {
    result.forEach((items) => {
      item = item + items;
    });
  }
  const newString = originString.replace(`{{${hookname}}}`, item);
  return newString;
}
async function apply(ctx, config2) {
  let logins = {};
  ctx.registerComponent("authority", {
    getLoginstatus(sessionid) {
      if (logins[sessionid]) {
        return true;
      } else {
        return false;
      }
    },
    async getUserinfo(sessionid) {
      if (logins[sessionid]) {
        return await user.getuserinfobyid(logins[sessionid]);
      } else {
        return false;
      }
    }
  });
  const user = ctx.component.user;
  ctx.route("/auth/login").action(async (session) => {
    const loginPath = resolvePath(config2.template.loginpath, __dirname);
    if (!fs.existsSync(loginPath)) return;
    let html = fs.readFileSync(loginPath, "utf-8");
    const loginHooks = [
      "authority:htmlheader",
      // header 外部
      "authority:preloginform",
      // form 前
      "authority:loginform",
      // form 内
      "authority:postloginform",
      // form 后
      "authority:htmlfooter"
      // footer 外部
    ];
    for (const hook of loginHooks) {
      html = await getHook(ctx, hook, html);
    }
    session.body = html;
    session.setMime("html");
  });
  ctx.route("/auth/register").action(async (session) => {
    const regPath = resolvePath(config2.template.regpath, __dirname);
    if (!fs.existsSync(regPath)) return;
    let html = fs.readFileSync(regPath, "utf-8");
    const registerHooks = [
      "authority:htmlheader",
      // header 外部
      "authority:preregisterform",
      // form 前
      "authority:registerform",
      // form 内
      "authority:postregisterform",
      // form 后
      "authority:htmlfooter"
      // footer 外部
    ];
    for (const hook of registerHooks) {
      html = await getHook(ctx, hook, html);
    }
    session.body = html;
    session.setMime("html");
  });
  ctx.route("/auth/style.css").action(async (session) => {
    const stylePath = resolvePath("../static/style.css", __dirname);
    if (fs.existsSync(stylePath)) {
      session.body = await getHook(ctx, "authority:css", fs.readFileSync(stylePath, "utf-8"));
      session.setMime("text/css");
    }
  });
  ctx.route("/auth/script.js").action(async (session) => {
    const scriptPath = resolvePath("../static/script.js", __dirname);
    if (fs.existsSync(scriptPath)) {
      session.body = await getHook(ctx, "authority:js", fs.readFileSync(scriptPath, "utf-8"));
      session.setMime("text/javascript");
    }
  });
  ctx.route("/auth/api/login").action(async (session, params) => {
    const body = await session.parseRequestBody();
    const username = body.username;
    const password = body.password;
    let fine = true;
    const paramObj = Object.fromEntries(params.entries());
    const result = await ctx.executeHook("authority:login", paramObj);
    result.forEach((r) => {
      if (!r) {
        fine = false;
      }
    });
    if (fine && username && password) {
      const result2 = await user.login(username, password);
      if (!result2) {
        session.body = JSON.stringify({ code: 1, message: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" });
        return;
      }
      const userInfo = await user.getuserinfo(username);
      if (userInfo) {
        logins[session.sessionid] = userInfo.id;
      }
      session.body = JSON.stringify({ code: 0, message: "\u767B\u5F55\u6210\u529F" });
    } else if (fine) {
      session.body = JSON.stringify({ code: 1, message: "\u7F3A\u5C11\u7528\u6237\u540D\u6216\u5BC6\u7801" });
    }
  });
  ctx.route("/auth/api/register").action(async (session, params) => {
    const body = await session.parseRequestBody();
    const username = body.username;
    const password = body.password;
    let fine = true;
    const paramObj = Object.fromEntries(params.entries());
    const result = await ctx.executeHook("authority:register", paramObj);
    result.forEach((r) => {
      if (!r) {
        fine = false;
      }
    });
    if (fine && username && password) {
      const result2 = await user.register(username, password);
      if (!result2) {
        session.body = JSON.stringify({ code: 1, message: "\u6CE8\u518C\u5931\u8D25" });
        return;
      }
      session.body = JSON.stringify({ code: 0, message: "\u6CE8\u518C\u6210\u529F" });
    } else if (fine) {
      session.body = JSON.stringify({ code: 1, message: "\u7F3A\u5C11\u7528\u6237\u540D\u6216\u5BC6\u7801" });
    }
  });
}
export {
  apply,
  config,
  depend,
  provide,
  resolvePath,
  usage
};
