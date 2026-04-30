import { Logger, Schema } from 'yumeri';
import 'yumeri-plugin-user';
import './types'; // Import for declaration merging
const logger = new Logger("permission");
export const depend = ['database', 'user'];
export const usage = `用户权限模型<br>依赖于yumeri-plugin-user（用户模型）<br>超管权限大小为10`;
export const provide = ['permission'];
export const config = Schema.object({
    defaultpermit: Schema.number('默认权限').default(1).required(),
});
export async function apply(ctx, config) {
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
