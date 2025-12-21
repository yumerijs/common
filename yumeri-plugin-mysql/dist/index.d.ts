import { Context, Schema } from 'yumeri';
export declare const provide: string[];
export interface MysqlConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    connectionLimit?: number;
    charset?: string;
}
export declare const config: Schema<MysqlConfig>;
export declare function apply(ctx: Context, config: MysqlConfig): Promise<void>;
export declare function disable(ctx: Context): Promise<void>;
