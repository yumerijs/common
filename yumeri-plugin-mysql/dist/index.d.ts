import { Schema, Context } from 'yumeri';

declare const provide: string[];
interface MysqlConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    connectionLimit?: number;
    charset?: string;
}
declare const config: Schema<MysqlConfig>;
declare function apply(ctx: Context, config: MysqlConfig): Promise<void>;
declare function disable(ctx: Context): Promise<void>;

export { type MysqlConfig, apply, config, disable, provide };
