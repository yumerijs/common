import { Context, Config, ConfigSchema } from 'yumeri';
export declare const provide: string[];
export declare const config: {
    schema: Record<string, ConfigSchema>;
};
export declare function apply(ctx: Context, config: Config): Promise<void>;
export declare function disable(ctx: Context): Promise<void>;
