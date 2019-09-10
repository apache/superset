/** Extract generic type from array */
export type Unarray<T> = T extends Array<infer U> ? U : T;

/** T or an array of T */
export type MayBeArray<T> = T | T[];

/** A value that has .toString() function */
export type HasToString = { toString(): string };

/** Make some fields that might have been optional become required fields */
export type RequiredSome<T, RequiredFields extends keyof T> = {
  [Field in Exclude<keyof T, RequiredFields>]?: T[Field];
} &
  {
    [Field in RequiredFields]-?: T[Field];
  };
