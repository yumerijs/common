import { Context, Schema } from 'yumeri';
import 'yumeri-plugin-user';
import './types';
export declare const depend: string[];
export declare const usage = "\u7528\u6237\u6743\u9650\u6A21\u578B<br>\u4F9D\u8D56\u4E8Eyumeri-plugin-user\uFF08\u7528\u6237\u6A21\u578B\uFF09<br>\u8D85\u7BA1\u6743\u9650\u5927\u5C0F\u4E3A10";
export declare const provide: string[];
export interface PermissionConfig {
    defaultpermit: number;
}
export declare const config: Schema<PermissionConfig>;
export interface Permit {
    getPermit(id: number): Promise<number>;
}
declare module 'yumeri' {
    interface Components {
        permission: Permit;
    }
}
export declare function apply(ctx: Context, config: PermissionConfig): Promise<void>;
