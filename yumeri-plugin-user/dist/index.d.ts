import { Context, Schema, Database } from 'yumeri';
export declare const depend: string[];
export declare const provide: string[];
export declare const usage = "\u63D0\u4F9B Yumeri \u7528\u6237\u6A21\u578B";
interface UserTable {
    id: number;
    username: string;
    password: string;
    email?: string | null;
    phone?: string | null;
    createAt: Date;
    updateAt: Date;
}
declare module 'yumeri' {
    interface Tables {
        user: UserTable;
    }
    interface Components {
        user: User;
    }
}
export interface UserConfig {
    name: string;
    isEmailopen: boolean;
    isPhoneopen: boolean;
    encryptType: string;
}
export declare const config: Schema<UserConfig>;
export declare class User {
    private db;
    private config;
    private tableName;
    constructor(db: Database, config: UserConfig);
    private hashPassword;
    getuserinfo(username: string): Promise<Pick<UserTable, "username" | "id" | "email" | "phone" | "createAt" | "updateAt"> | undefined>;
    getuserinfobyid(id: number): Promise<Pick<UserTable, "username" | "id" | "email" | "phone" | "createAt" | "updateAt"> | undefined>;
    updateuserinfo(id: number, data: Partial<UserTable>): Promise<number>;
    changepassword(username: string, password: string): Promise<number>;
    register(username: string, password: string, email?: string, phone?: string): Promise<false | UserTable>;
    login(username: string, password: string): Promise<boolean>;
}
export declare function apply(ctx: Context, config: UserConfig): Promise<void>;
export {};
