/** Extract generic type from array */
export type Unarray<T> = T extends Array<infer U> ? U : T;

/** T or an array of T */
export type MayBeArray<T> = T | T[];

/** A value that has .toString() function */
export type HasToString = { toString(): string };
