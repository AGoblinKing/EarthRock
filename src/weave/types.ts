export type ID = string;

export enum EWarp {
    SPACE = "SPACE",
    MATH = "MATH",
    VALUE = "VALUE",
    MAIL = "MAIL"
}

export interface WarpJSON<T> {
    id?: ID;
    type?: EWarp;
    value: T;
}

export interface WarpsJSON {
    [key: string]: WarpJSON<any>;
}

export interface WeaveJSON {
    name: string;
    wefts: Wefts;
    warps: WarpsJSON;
    rezed: Array<ID>;
}

export interface Wefts {
    [key: string]: ID;
}
