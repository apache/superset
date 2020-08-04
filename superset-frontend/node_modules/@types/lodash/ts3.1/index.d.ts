/// <reference path="./common/common.d.ts" />
/// <reference path="./common/array.d.ts" />
/// <reference path="./common/collection.d.ts" />
/// <reference path="./common/date.d.ts" />
/// <reference path="./common/function.d.ts" />
/// <reference path="./common/lang.d.ts" />
/// <reference path="./common/math.d.ts" />
/// <reference path="./common/number.d.ts" />
/// <reference path="./common/object.d.ts" />
/// <reference path="./common/seq.d.ts" />
/// <reference path="./common/string.d.ts" />
/// <reference path="./common/util.d.ts" />

export = _;
export as namespace _;

declare const _: _.LoDashStatic;
declare namespace _ {
    // tslint:disable-next-line no-empty-interface (This will be augmented)
    interface LoDashStatic {}
}

// Backward compatibility with --target es5
declare global {
    // tslint:disable-next-line:no-empty-interface
    interface Set<T> { }
    // tslint:disable-next-line:no-empty-interface
    interface Map<K, V> { }
    // tslint:disable-next-line:no-empty-interface
    interface WeakSet<T> { }
    // tslint:disable-next-line:no-empty-interface
    interface WeakMap<K extends object, V> { }
}
