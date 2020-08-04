import 'array-flat-polyfill';
import {default as clone_} from 'clone';
import deepEqual_ from 'fast-deep-equal';
import stableStringify from 'fast-json-stable-stringify';
import {hasOwnProperty, isNumber, isString, splitAccessPath, stringValue, writeConfig} from 'vega-util';
import {isLogicalAnd, isLogicalNot, isLogicalOr, LogicalComposition} from './logical';

export const deepEqual = deepEqual_;
export const duplicate = clone_;

/**
 * Creates an object composed of the picked object properties.
 *
 * var object = {'a': 1, 'b': '2', 'c': 3};
 * pick(object, ['a', 'c']);
 * // → {'a': 1, 'c': 3}
 */
export function pick<T extends object, K extends keyof T>(obj: T, props: readonly K[]): Pick<T, K> {
  const copy: any = {};
  for (const prop of props) {
    if (hasOwnProperty(obj, prop)) {
      copy[prop] = obj[prop];
    }
  }
  return copy;
}

/**
 * The opposite of _.pick; this method creates an object composed of the own
 * and inherited enumerable string keyed properties of object that are not omitted.
 */
export function omit<T extends object, K extends keyof T>(obj: T, props: readonly K[]): Omit<T, K> {
  const copy = {...(obj as any)};
  for (const prop of props) {
    delete copy[prop];
  }
  return copy;
}

/**
 * Monkey patch Set so that `stringify` produces a string representation of sets.
 */
Set.prototype['toJSON'] = function() {
  return `Set(${[...this].map(x => stableStringify(x)).join(',')})`;
};

/**
 * Converts any object to a string representation that can be consumed by humans.
 */
export const stringify = stableStringify;

/**
 * Converts any object to a string of limited size, or a number.
 */
export function hash(a: any): string | number {
  if (isNumber(a)) {
    return a;
  }

  const str = isString(a) ? a : stableStringify(a);

  // short strings can be used as hash directly, longer strings are hashed to reduce memory usage
  if (str.length < 250) {
    return str;
  }

  // from http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    h = (h << 5) - h + char;
    h = h & h; // Convert to 32bit integer
  }
  return h;
}

export function isNullOrFalse(x: any): x is false | null {
  return x === false || x === null;
}

export function contains<T>(array: readonly T[], item: T) {
  return array.indexOf(item) > -1;
}

/** Returns the array without the elements in item */
export function without<T>(array: readonly T[], excludedItems: readonly T[]) {
  return array.filter(item => !contains(excludedItems, item));
}

export function union<T>(array: readonly T[], other: readonly T[]) {
  return array.concat(without(other, array));
}

/**
 * Returns true if any item returns true.
 */
export function some<T>(arr: readonly T[], f: (d: T, k?: any, i?: any) => boolean) {
  let i = 0;
  for (const [k, a] of arr.entries()) {
    if (f(a, k, i++)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if all items return true.
 */
export function every<T>(arr: readonly T[], f: (d: T, k?: any, i?: any) => boolean) {
  let i = 0;
  for (const [k, a] of arr.entries()) {
    if (!f(a, k, i++)) {
      return false;
    }
  }
  return true;
}

/**
 * Like TS Partial but applies recursively to all properties.
 */
export type DeepPartial<T> = {[P in keyof T]?: DeepPartial<T[P]>};

/**
 * recursively merges src into dest
 */
export function mergeDeep<T>(dest: T, ...src: readonly DeepPartial<T>[]): T {
  for (const s of src) {
    deepMerge_(dest, s ?? {});
  }
  return dest;
}

function deepMerge_(dest: any, src: any) {
  for (const property of Object.keys(src)) {
    writeConfig(dest, property, src[property], true);
  }
}

export function unique<T>(values: readonly T[], f: (item: T) => string | number): T[] {
  const results: T[] = [];
  const u = {};
  let v: string | number;
  for (const val of values) {
    v = f(val);
    if (v in u) {
      continue;
    }
    u[v] = 1;
    results.push(val);
  }
  return results;
}

export interface Dict<T> {
  [key: string]: T;
}

/**
 * Returns true if the two dictionaries disagree. Applies only to defined values.
 */
export function isEqual<T>(dict: Dict<T>, other: Dict<T>) {
  const dictKeys = keys(dict);
  const otherKeys = keys(other);
  if (dictKeys.length !== otherKeys.length) {
    return false;
  }
  for (const key of dictKeys) {
    if (dict[key] !== other[key]) {
      return false;
    }
  }
  return true;
}

export function setEqual<T>(a: Set<T>, b: Set<T>) {
  if (a.size !== b.size) {
    return false;
  }
  for (const e of a) {
    if (!b.has(e)) {
      return false;
    }
  }
  return true;
}

export function hasIntersection<T>(a: ReadonlySet<T>, b: ReadonlySet<T>) {
  for (const key of a) {
    if (b.has(key)) {
      return true;
    }
  }
  return false;
}

export function prefixGenerator(a: ReadonlySet<string>): ReadonlySet<string> {
  const prefixes = new Set<string>();
  for (const x of a) {
    const splitField = splitAccessPath(x);
    // Wrap every element other than the first in `[]`
    const wrappedWithAccessors = splitField.map((y, i) => (i === 0 ? y : `[${y}]`));
    const computedPrefixes = wrappedWithAccessors.map((_, i) => wrappedWithAccessors.slice(0, i + 1).join(''));
    computedPrefixes.forEach(y => prefixes.add(y));
  }
  return prefixes;
}

/**
 * Returns true if a and b have an intersection. Also return true if a or b are undefined
 * since this means we don't know what fields a node produces or depends on.
 */
export function fieldIntersection(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === undefined || b === undefined) {
    return true;
  }
  return hasIntersection(prefixGenerator(a), prefixGenerator(b));
}

// This is a stricter version of Object.keys but with better types. See https://github.com/Microsoft/TypeScript/pull/12253#issuecomment-263132208
export const keys = Object.keys as <T>(o: T) => Extract<keyof T, string>[];

export function vals<T>(x: {[key: string]: T}): T[] {
  const _vals: T[] = [];
  for (const k in x) {
    if (hasOwnProperty(x, k)) {
      _vals.push(x[k]);
    }
  }
  return _vals;
}

export function entries<T>(x: {[key: string]: T}): {key: string; value: T}[] {
  const _entries: {key: string; value: T}[] = [];
  for (const k in x) {
    if (hasOwnProperty(x, k)) {
      _entries.push({
        key: k,
        value: x[k]
      });
    }
  }
  return _entries;
}

// Using mapped type to declare a collect of flags for a string literal type S
// https://www.typescriptlang.org/docs/handbook/advanced-types.html#mapped-types
export type Flag<S extends string> = {[K in S]: 1};

export function isBoolean(b: any): b is boolean {
  return b === true || b === false;
}

/**
 * Convert a string into a valid variable name
 */
export function varName(s: string): string {
  // Replace non-alphanumeric characters (anything besides a-zA-Z0-9_) with _
  const alphanumericS = s.replace(/\W/g, '_');

  // Add _ if the string has leading numbers.
  return (s.match(/^\d+/) ? '_' : '') + alphanumericS;
}

export function logicalExpr<T>(op: LogicalComposition<T>, cb: (...args: readonly any[]) => string): string {
  if (isLogicalNot(op)) {
    return '!(' + logicalExpr(op.not, cb) + ')';
  } else if (isLogicalAnd(op)) {
    return '(' + op.and.map((and: LogicalComposition<T>) => logicalExpr(and, cb)).join(') && (') + ')';
  } else if (isLogicalOr(op)) {
    return '(' + op.or.map((or: LogicalComposition<T>) => logicalExpr(or, cb)).join(') || (') + ')';
  } else {
    return cb(op);
  }
}

/**
 * Delete nested property of an object, and delete the ancestors of the property if they become empty.
 */
export function deleteNestedProperty(obj: any, orderedProps: string[]) {
  if (orderedProps.length === 0) {
    return true;
  }
  const prop = orderedProps.shift()!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  if (deleteNestedProperty(obj[prop], orderedProps)) {
    delete obj[prop];
  }
  return keys(obj).length === 0;
}

export function titlecase(s: string) {
  return s.charAt(0).toUpperCase() + s.substr(1);
}

function escapePathAccess(string: string) {
  return string.replace(/(\[|\]|\.)/g, '\\$1');
}

/**
 * Converts a path to an access path with datum.
 * @param path The field name.
 * @param datum The string to use for `datum`.
 */
export function accessPathWithDatum(path: string, datum = 'datum') {
  const pieces = splitAccessPath(path);
  const prefixes = [];
  for (let i = 1; i <= pieces.length; i++) {
    const prefix = `[${pieces
      .slice(0, i)
      .map(stringValue)
      .join('][')}]`;
    prefixes.push(`${datum}${prefix}`);
  }
  return prefixes.join(' && ');
}

/**
 * Return access with datum to the flattened field.
 *
 * @param path The field name.
 * @param datum The string to use for `datum`.
 */
export function flatAccessWithDatum(path: string, datum: 'datum' | 'parent' | 'datum.datum' = 'datum') {
  return `${datum}[${stringValue(splitAccessPath(path).join('.'))}]`;
}

/**
 * Replaces path accesses with access to non-nested field.
 * For example, `foo["bar"].baz` becomes `foo\\.bar\\.baz`.
 */
export function replacePathInField(path: string) {
  return `${splitAccessPath(path)
    .map(escapePathAccess)
    .join('\\.')}`;
}

/**
 * Replace all ocurrences of a string with another string.
 *
 * @param string the string to replace in
 * @param find the string to replace
 * @param replacement the replacement
 */
export function replaceAll(string: string, find: string, replacement: string) {
  return string.replace(new RegExp(find.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replacement);
}

/**
 * Remove path accesses with access from field.
 * For example, `foo["bar"].baz` becomes `foo.bar.baz`.
 */
export function removePathFromField(path: string) {
  return `${splitAccessPath(path).join('.')}`;
}

/**
 * Count the depth of the path. Returns 1 for fields that are not nested.
 */
export function accessPathDepth(path: string) {
  if (!path) {
    return 0;
  }
  return splitAccessPath(path).length;
}

/**
 * This is a replacement for chained || for numeric properties or properties that respect null so that 0 will be included.
 */
export function getFirstDefined<T>(...args: readonly T[]): T | undefined {
  for (const arg of args) {
    if (arg !== undefined) {
      return arg;
    }
  }
  return undefined;
}

// variable used to generate id
let idCounter = 42;

/**
 * Returns a new random id every time it gets called.
 *
 * Has side effect!
 */
export function uniqueId(prefix?: string) {
  const id = ++idCounter;
  return prefix ? String(prefix) + id : id;
}

/**
 * Resets the id counter used in uniqueId. This can be useful for testing.
 */
export function resetIdCounter() {
  idCounter = 42;
}

export function internalField(name: string) {
  return isInternalField(name) ? name : `__${name}`;
}

export function isInternalField(name: string) {
  return name.indexOf('__') === 0;
}

/**
 * Normalize angle to be within [0,360).
 */
export function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

/**
 * Returns whether the passed in value is a valid number.
 */
export function isNumeric(value: number | string): boolean {
  if (isNumber(value)) {
    return true;
  }
  return !isNaN(value as any) && !isNaN(parseFloat(value));
}
