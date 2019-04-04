/// <reference types="jest" />
interface MockWithArgs<T> extends Function, jest.MockInstance<T> {
    new (...args: ArgumentsOf<T>): T;
    (...args: ArgumentsOf<T>): any;
}
declare type MethodKeysOf<T> = {
    [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];
declare type PropertyKeysOf<T> = {
    [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
declare type ArgumentsOf<T> = T extends (...args: infer A) => any ? A : never;
interface MockWithArgs<T> extends Function, jest.MockInstance<T> {
    new (...args: ArgumentsOf<T>): T;
    (...args: ArgumentsOf<T>): any;
}
declare type MockedFunction<T> = MockWithArgs<T> & {
    [K in keyof T]: T[K];
};
declare type MockedFunctionDeep<T> = MockWithArgs<T> & MockedObjectDeep<T>;
declare type MockedObject<T> = {
    [K in MethodKeysOf<T>]: MockedFunction<T[K]>;
} & {
    [K in PropertyKeysOf<T>]: T[K];
};
declare type MockedObjectDeep<T> = {
    [K in MethodKeysOf<T>]: MockedFunctionDeep<T[K]>;
} & {
    [K in PropertyKeysOf<T>]: MaybeMockedDeep<T[K]>;
};
export declare type MaybeMockedDeep<T> = T extends Function ? MockedFunctionDeep<T> : T extends object ? MockedObjectDeep<T> : T;
export declare type MaybeMocked<T> = T extends Function ? MockedFunction<T> : T extends object ? MockedObject<T> : T;
export declare function mocked<T>(item: T, deep?: false): MaybeMocked<T>;
export declare function mocked<T>(item: T, deep: true): MaybeMockedDeep<T>;
export {};
