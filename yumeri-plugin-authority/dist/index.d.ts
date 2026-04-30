import { Context, Schema } from 'yumeri';
import 'yumeri-plugin-user';
export declare const depend: string[];
export declare const provide: string[];
export declare const usage = "\u7528\u6237\u767B\u9646\u9A8C\u8BC1\u670D\u52A1<br>\u4F9D\u8D56\u4E8Eyumeri-plugin-user\uFF08\u7528\u6237\u6A21\u578B\uFF09";
declare module 'yumeri' {
    interface Components {
        authority: Authority;
    }
}
interface TemplateConfig {
    loginpath: string;
    regpath: string;
}
export interface AuthorityConfig {
    template: TemplateConfig;
}
export declare const config: Schema<AuthorityConfig>;
export declare function resolvePath(inputPath: string, currentFileDirectory: string): string;
export interface Authority {
    getLoginstatus(sessionid: string): boolean;
    getUserinfo(sessionid: string): Promise<Record<string, any>> | false;
}
export declare function apply(ctx: Context, config: AuthorityConfig): Promise<void>;
export {};
