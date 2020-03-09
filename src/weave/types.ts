
export type NAME = string;

export enum EWarp {
    SPACE = "SPACE",
    MATH = "MATH",
    VALUE = "VALUE",
    MAIL = "MAIL"
}

export interface WarpJSON<T> {
    name?: NAME;
    type?: EWarp;
    value: T;
}

export interface WarpsJSON {
    [key: string]: WarpJSON<any>;
}

export interface IWeaveJSON {
    name: string;
    wefts: Wefts;
    warps: WarpsJSON;
    rezed: Array<NAME>;
}

export interface Wefts {
    [key: string]: NAME;
}