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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.usage = exports.provide = exports.depend = void 0;
exports.resolvePath = resolvePath;
exports.apply = apply;
const yumeri_1 = require("yumeri");
const path = __importStar(require("path"));
const fs_1 = __importDefault(require("fs"));
require("yumeri-plugin-user");
const logger = new yumeri_1.Logger("authority");
exports.depend = ['user']; // 需要的服务
exports.provide = ['authority']; // 提供的服务
exports.usage = `用户登陆验证服务<br>依赖于yumeri-plugin-user（用户模型）`;
exports.config = yumeri_1.Schema.object({
    template: yumeri_1.Schema.object({
        loginpath: yumeri_1.Schema.string('登录页模板地址').default('../static/login.html'),
        regpath: yumeri_1.Schema.string('注册页模板地址').default('../static/reg.html'),
    }, 'HTML模板配置'),
});
function resolvePath(inputPath, currentFileDirectory) {
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }
    else {
        return path.resolve(currentFileDirectory, inputPath);
    }
}
async function getHook(ctx, hookname, originString) {
    const result = await ctx.executeHook(hookname);
    let item = '';
    if (result) {
        result.forEach((items) => {
            item = item + items;
        });
    }
    const newString = originString.replace(`{{${hookname}}}`, item);
    return newString;
}
async function apply(ctx, config) {
    let logins = {};
    ctx.registerComponent('authority', {
        getLoginstatus(sessionid) {
            if (logins[sessionid]) {
                return true;
            }
            else {
                return false;
            }
        },
        async getUserinfo(sessionid) {
            if (logins[sessionid]) {
                return await user.getuserinfobyid(logins[sessionid]);
            }
            else {
                return false;
            }
        }
    });
    const user = ctx.component.user;
    // HTML Pages
    ctx.route('/auth/login').action(async (session) => {
        const loginPath = resolvePath(config.template.loginpath, __dirname);
        if (!fs_1.default.existsSync(loginPath))
            return;
        let html = fs_1.default.readFileSync(loginPath, 'utf-8');
        // 登录页 HTML hook 点位
        const loginHooks = [
            'authority:htmlheader', // header 外部
            'authority:preloginform', // form 前
            'authority:loginform', // form 内
            'authority:postloginform', // form 后
            'authority:htmlfooter', // footer 外部
        ];
        for (const hook of loginHooks) {
            html = await getHook(ctx, hook, html);
        }
        session.body = html;
        session.setMime('html');
    });
    ctx.route('/auth/register').action(async (session) => {
        const regPath = resolvePath(config.template.regpath, __dirname);
        if (!fs_1.default.existsSync(regPath))
            return;
        let html = fs_1.default.readFileSync(regPath, 'utf-8');
        // 注册页 HTML hook 点位
        const registerHooks = [
            'authority:htmlheader', // header 外部
            'authority:preregisterform', // form 前
            'authority:registerform', // form 内
            'authority:postregisterform', // form 后
            'authority:htmlfooter', // footer 外部
        ];
        for (const hook of registerHooks) {
            html = await getHook(ctx, hook, html);
        }
        session.body = html;
        session.setMime('html');
    });
    // Static Assets
    ctx.route('/auth/style.css').action(async (session) => {
        const stylePath = resolvePath('../static/style.css', __dirname);
        if (fs_1.default.existsSync(stylePath)) {
            session.body = await getHook(ctx, 'authority:css', fs_1.default.readFileSync(stylePath, 'utf-8'));
            session.setMime('text/css');
        }
    });
    ctx.route('/auth/script.js').action(async (session) => {
        const scriptPath = resolvePath('../static/script.js', __dirname);
        if (fs_1.default.existsSync(scriptPath)) {
            session.body = await getHook(ctx, 'authority:js', fs_1.default.readFileSync(scriptPath, 'utf-8'));
            session.setMime('text/javascript');
        }
    });
    // API routes
    ctx.route('/auth/api/login').action(async (session, params) => {
        const body = await session.parseRequestBody();
        const username = body.username;
        const password = body.password;
        let fine = true;
        const paramObj = Object.fromEntries(params.entries());
        const result = await ctx.executeHook('authority:login', paramObj);
        result.forEach((r) => {
            if (!r) {
                fine = false;
            }
        });
        if (fine && username && password) {
            const result = await user.login(username, password);
            if (!result) {
                session.body = JSON.stringify({ code: 1, message: '用户名或密码错误' });
                return;
            }
            const userInfo = await user.getuserinfo(username);
            if (userInfo) {
                logins[session.sessionid] = userInfo.id;
            }
            session.body = JSON.stringify({ code: 0, message: '登录成功' });
        }
        else if (fine) {
            session.body = JSON.stringify({ code: 1, message: '缺少用户名或密码' });
        }
    });
    ctx.route('/auth/api/register').action(async (session, params) => {
        const body = await session.parseRequestBody();
        const username = body.username;
        const password = body.password;
        let fine = true;
        const paramObj = Object.fromEntries(params.entries());
        const result = await ctx.executeHook('authority:register', paramObj);
        result.forEach((r) => {
            if (!r) {
                fine = false;
            }
        });
        if (fine && username && password) {
            const result = await user.register(username, password);
            if (!result) {
                session.body = JSON.stringify({ code: 1, message: '注册失败' });
                return;
            }
            session.body = JSON.stringify({ code: 0, message: '注册成功' });
        }
        else if (fine) {
            session.body = JSON.stringify({ code: 1, message: '缺少用户名或密码' });
        }
    });
}
