import { Schema, Context } from 'yumeri';

declare const provide: string[];
interface SqliteConfig {
    path: string;
}
declare const config: Schema<SqliteConfig>;
declare function apply(ctx: Context, config: SqliteConfig): Promise<void>;
declare function disable(ctx: Context): Promise<void>;

export { type SqliteConfig, apply, config, disable, provide };
