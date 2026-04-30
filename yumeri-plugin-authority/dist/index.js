import { Logger, Schema } from 'yumeri';
import * as path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'yumeri-plugin-user';
const logger = new Logger("authority");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const depend = ['user']; // 需要的服务
export const provide = ['authority']; // 提供的服务
export const usage = `用户登陆验证服务<br>依赖于yumeri-plugin-user（用户模型）`;
export const config = Schema.object({
    template: Schema.object({
        loginpath: Schema.string('登录页模板地址').default('../static/login.html'),
        regpath: Schema.string('注册页模板地址').default('../static/reg.html'),
    }, 'HTML模板配置'),
});
export function resolvePath(inputPath, currentFileDirectory) {
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
export async function apply(ctx, config) {
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
        if (!fs.existsSync(loginPath))
            return;
        let html = fs.readFileSync(loginPath, 'utf-8');
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
        if (!fs.existsSync(regPath))
            return;
        let html = fs.readFileSync(regPath, 'utf-8');
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
        if (fs.existsSync(stylePath)) {
            session.body = await getHook(ctx, 'authority:css', fs.readFileSync(stylePath, 'utf-8'));
            session.setMime('text/css');
        }
    });
    ctx.route('/auth/script.js').action(async (session) => {
        const scriptPath = resolvePath('../static/script.js', __dirname);
        if (fs.existsSync(scriptPath)) {
            session.body = await getHook(ctx, 'authority:js', fs.readFileSync(scriptPath, 'utf-8'));
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
