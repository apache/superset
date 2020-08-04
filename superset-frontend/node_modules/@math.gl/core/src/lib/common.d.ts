type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array;

type ConfigurationOptions = {
  EPSILON?: number;
  debug?: boolean;
  precision?: number;
  printTypes?: boolean;
  printDegrees?: boolean;
  printRowMajor?: boolean;
  _cartographicRadians?: boolean;
};

export const config: ConfigurationOptions;

export function configure(options?: ConfigurationOptions): ConfigurationOptions;

export function formatValue(value: number, options?: ConfigurationOptions): string;

/**
 * Check if value is an "array"
 * Returns `true` if value is either an array or a typed array
 *
 * Note: returns `false` for `ArrayBuffer` and `DataView` instances
 */
export function isArray(value: any): boolean;

export function clone(array: number[]): number[];
export function clone(array: TypedArray): TypedArray;

export function toRadians(degrees: number): number;
export function toRadians(degrees: number[]): number[];
export function toRadians(degrees: TypedArray): TypedArray;
export function toDegrees(radians: number): number;
export function toDegrees(radians: number[]): number[];
export function toDegrees(radians: TypedArray): TypedArray;

// GLSL math function equivalents: Work on both single values and vectors

/* eslint-disable no-shadow */

export function radians(degrees, result?);
export function degrees(radians, result?);

/** "GLSL equivalent" of `Math.sin` Works on single values and vectors */
export function sin(radians: number): number;
export function sin(radians: number[]): number[];
// "GLSL equivalent" of Math. : Works on single values and vectors
export function cos(radians);
/** "GLSL equivalent" of `Math.tan`: Works on single values and vectors */
export function tan(radians);

/** "GLSL equivalent" of `Math.asin`: Works on single values and vectors */
export function asin(radians);
/** "GLSL equivalent" of `Math.acos`: Works on single values and vectors */
export function acos(radians);
/** "GLSL equivalent" of `Math.atan`: Works on single values and vectors */
export function atan(radians);

/** GLSL style value clamping: Works on single values and vectors */
export function clamp(value, min, max);

// Interpolate between two numbers or two arrays
export function lerp(a, b, t: number);

export function equals(a, b, epsilon?: number);

export function exactEquals(a, b);

export function withEpsilon(epsilon: number, func: any): any;
