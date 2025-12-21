"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.provide = exports.usage = exports.depend = void 0;
exports.apply = apply;
const yumeri_1 = require("yumeri");
require("yumeri-plugin-user");
require("./types"); // Import for declaration merging
const logger = new yumeri_1.Logger("permission");
exports.depend = ['database', 'user'];
exports.usage = `用户权限模型<br>依赖于yumeri-plugin-user（用户模型）<br>超管权限大小为10`;
exports.provide = ['permission'];
exports.config = yumeri_1.Schema.object({
    defaultpermit: yumeri_1.Schema.number('默认权限').default(1).required(),
});
async function apply(ctx, config) {
    const db = ctx.component.database;
    // Use extend() to define the table schema. This is idempotent.
    await db.extend('permission', {
        id: { type: 'unsigned', nullable: false },
        permit: { type: 'unsigned', initial: config.defaultpermit }
    }, { primary: 'id' });
    ctx.registerComponent('permission', {
        async getPermit(id) {
            const result = await db.selectOne('permission', { id });
            if (result) {
                return result.permit;
            }
            else {
                // Although the table has a default, a record might not exist yet for a new user.
                // Creating it here ensures consistency.
                await db.create('permission', {
                    id,
                    permit: config.defaultpermit
                });
                return config.defaultpermit;
            }
        }
    });
}
