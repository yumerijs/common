import { Context, Schema } from 'yumeri';
export declare const provide: string[];
export interface SqliteConfig {
    path: string;
}
export declare const config: Schema<SqliteConfig>;
export declare function apply(ctx: Context, config: SqliteConfig): Promise<void>;
export declare function disable(ctx: Context): Promise<void>;
