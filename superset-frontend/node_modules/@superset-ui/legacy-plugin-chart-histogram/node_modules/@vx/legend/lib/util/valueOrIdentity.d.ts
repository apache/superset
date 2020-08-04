export declare type ValueOrIdentity<T> = T | {
    value?: T;
};
/** Returns an object's value if defined, or the object. */
export default function valueOrIdentity<T>(_: ValueOrIdentity<T>): T;
/** Returns an object's value if defined, or the object, coerced to a string. */
export declare function valueOrIdentityString<T>(_: ValueOrIdentity<T>): string;
//# sourceMappingURL=valueOrIdentity.d.ts.map