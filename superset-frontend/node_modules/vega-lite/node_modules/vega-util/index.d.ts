// Functions

type Fn<R> = (...args: readonly any[]) => R;
export type AccessorFn<R = any> = Fn<R> & { fname?: string; fields: readonly string[] };

export function accessor<R>(fn: Fn<R>, fields?: readonly string[], name?: string): AccessorFn<R>;
export function accessorFields(fn: AccessorFn): string[];
export function accessorName(fn: AccessorFn): string;

export type Order = 'ascending' | 'descending';

export function compare(fields: string | readonly string[] | AccessorFn | readonly AccessorFn[], orders?: Order | readonly Order[]): (a: any, b: any) => number;

export function constant<V>(v: V): () => V;

export function debounce<F extends Function>(delay: number, func: F): F;

export function field(field: string, name?: string): AccessorFn;

export function id(_: object): symbol;

export function identity<V>(v: V): V;

export function key(fields: readonly string[], flat?: boolean): (_: object) => string;

export function one(): 1;
export function zero(): 0;
export function truthy(): true;
export function falsy(): false;

// Type Checkers

export function isArray<T>(a: any | T[]): a is T[];
export function isArray<T>(a: any | readonly T[]): a is readonly T[];
export function isBoolean(a: any): a is boolean;
export function isDate(a: any): a is Date;
export function isFunction(a: any): a is Function;
export function isNumber(a: any): a is number;
export function isObject(a: any): a is object;
export function isRegExp(a: any): a is RegExp;
export function isString(a: any): a is string;

// Type Coercion

export function toBoolean(a: any): boolean;
export function toDate(a: any, parser?: (_: any) => number): number;
export function toNumber(a: any): number;
export function toString(a: any): string;

// Objects

export function extend<T>(target: T, ...source: readonly Partial<T>[]): T;
export function inherits<C extends object, P extends object>(
  child: C,
  parent: P
): C & P;

export function hasOwnProperty(object: object, property: PropertyKey): boolean;

export interface FastMap {
  size: number;
  empty: number;
  has: (f: string) => boolean;
  get: (f: string) => any;
  set: (f: string, v: any) => void;
  delete: (f: string) => void;
  clean: () => void;
}
export function fastmap(_?: object): FastMap;

export function mergeConfig<C extends object>(...c: C[]): C;
export function writeConfig<C extends object>(c: C, key: string, value: any, recurse?: boolean | object): void;

// Arrays

export function array<T>(v: T | T[]): T[];
export function array<T>(v: T | readonly T[]): readonly T[];

export function clampRange(range: readonly number[], min: number, max: number): number[];

export function extent(array: readonly number[], accessor?: AccessorFn): number[];
export function extentIndex(array: readonly number[], accessor?: AccessorFn): number[];

export function flush<T extends any>(range: readonly number[], value: number, threshold: number, left: T, right: T, center: T): T;

export function inrange(value: number, range: readonly number[], left: boolean, right: boolean): boolean;

export function lerp(array: readonly number[], fraction: number): number;

export function merge(compare: (a: any, b: any) => number,
  array1: any[], array2: any[]): any[];
export function merge(compare: (a: any, b: any) => number,
  array1: any[], array2: any[], output?: any[]): void;

export function panLinear(domain: readonly number[], delta: number): number[];
export function panLog(domain: readonly number[], delta: number): number[];
export function panPow(domain: readonly number[], delta: number, exponent: number): number[];
export function panSymlog(domain: readonly number[], delta: number, constant: number): number[];

export function peek(array: readonly any[]): any;

export function span(array: readonly number[]): number;

export function toSet<T>(array: readonly T[]): { [T: string]: true }

export function visitArray(array: readonly any[] | undefined,
  filter: (any: any) => boolean | undefined,
  visitor: (v: any, i: number, arr: readonly any[]) => void): void;

export function zoomLinear(domain: readonly number[],
  anchor: number | null, scale: number): number[];

export function zoomLog(domain: readonly number[],
  anchor: number | null, scale: number): number[];

export function zoomPow(domain: readonly number[],
  anchor: number | null, scale: number, exponent: number): number[];

export function zoomSymlog(domain: readonly number[],
  anchor: number | null, scale: number, constant: number): number[];

// Dates

export function quarter(date: number): number;
export function quarter(date: Date): number;

export function utcquarter(date: number): number;
export function utcquarter(date: Date): number;

// Strings

export function pad(str: string, len: number,
  char?: string, align?: 'left' | 'center' | 'right'): string;

export function repeat(str: string, count: number): string;

export function splitAccessPath(path: string): string[];
export function stringValue(a: any): string;

export function truncate(a: string, length: number,
  align?: 'left' | 'center' | 'right', ellipsis?: string): string;

// Logging

export interface LoggerInterface {
  level: (_: number) => number | LoggerInterface;
  error(...args: readonly any[]): LoggerInterface;
  warn(...args: readonly any[]): LoggerInterface;
  info(...args: readonly any[]): LoggerInterface;
  debug(...args: readonly any[]): LoggerInterface;
}

export const None: number;
export const Warn: number;
export const Info: number;
export const Debug: number;

export function logger(_?: number, method?: string): LoggerInterface;
export function log(...args: readonly any[]): void;
export function error(msg: string): Error;
