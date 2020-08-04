// Type definitions for D3JS d3-array module 2.0
// Project: https://github.com/d3/d3-array, https://d3js.org/d3-array
// Definitions by: Alex Ford <https://github.com/gustavderdrache>
//                 Boris Yankov <https://github.com/borisyankov>
//                 Tom Wanzek <https://github.com/tomwanzek>
//                 denisname <https://github.com/denisname>,
//                 Hugues Stefanski <https://github.com/ledragon>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

// Last module patch version validated against: 2.0.3

// --------------------------------------------------------------------------
// Shared Types and Interfaces
// --------------------------------------------------------------------------

/**
 * Administrivia: JavaScript primitive types and Date
 */
export type Primitive = number | string | boolean | Date;

/**
 * Administrivia: anything with a valueOf(): number method is comparable, so we allow it in numeric operations
 */
export interface Numeric {
    valueOf(): number;
}

// --------------------------------------------------------------------------------------
// Descriptive Statistics
// --------------------------------------------------------------------------------------

/**
 * Return the maximum value in the array of strings using natural order.
 */
export function max(array: Iterable<string>): string | undefined;

/**
 * Return the maximum value in the array of numbers using natural order.
 */
export function max<T extends Numeric>(array: Iterable<T>): T | undefined;

/**
 * Return the maximum value in the array using natural order and a projection function to map values to strings.
 */
export function max<T>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => string | undefined | null): string | undefined;

/**
 * Return the maximum value in the array using natural order and a projection function to map values to easily-sorted values.
 */
export function max<T, U extends Numeric>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => U | undefined | null): U | undefined;

/**
 * Return the minimum value in the array using natural order.
 */
export function min(array: Iterable<string>): string | undefined;

/**
 * Return the minimum value in the array using natural order.
 */
export function min<T extends Numeric>(array: Iterable<T>): T | undefined;

/**
 * Return the minimum value in the array using natural order.
 */
export function min<T>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => string | undefined | null): string | undefined;

/**
 * Return the minimum value in the array using natural order.
 */
export function min<T, U extends Numeric>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => U | undefined | null): U | undefined;

/**
 * Return the min and max simultaneously.
 */
export function extent(array: Iterable<string>): [string, string] | [undefined, undefined];

/**
 * Return the min and max simultaneously.
 */
export function extent<T extends Numeric>(array: Iterable<T>): [T, T] | [undefined, undefined];

/**
 * Return the min and max simultaneously.
 */
export function extent<T>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => string | undefined | null): [string, string] | [undefined, undefined];

/**
 * Return the min and max simultaneously.
 */
export function extent<T, U extends Numeric>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => U | undefined | null): [U, U] | [undefined, undefined];

/**
 * Return the mean of an array of numbers
 */
export function mean<T extends Numeric>(array: Iterable<T | undefined | null>): number | undefined;

/**
 * Return the mean of an array of numbers
 */
export function mean<T>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => number | undefined | null): number | undefined;

/**
 * Return the median of an array of numbers
 */
export function median<T extends Numeric>(array: Iterable<T | undefined | null>): number | undefined;

/**
 * Return the median of an array of numbers
 */
export function median<T>(array: Iterable<T>, accessor: (element: T, i: number, array: Iterable<T>) => number | undefined | null): number | undefined;

/**
 * Returns the p-quantile of an array of numbers
 */
export function quantile<T extends Numeric>(array: Iterable<T | undefined | null>, p: number): number | undefined;

export function quantile<T>(array: Iterable<T>, p: number, accessor: (element: T, i: number, array: Iterable<T>) => number | undefined | null): number | undefined;

/**
 * Compute the sum of an array of numbers.
 */
export function sum<T extends Numeric>(array: Iterable<T | undefined | null>): number;

/**
 * Compute the sum of an array, using the given accessor to convert values to numbers.
 */
export function sum<T>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => number | undefined | null): number;

/**
 * Compute the standard deviation, defined as the square root of the bias-corrected variance, of the given array of numbers.
 */
export function deviation<T extends Numeric>(array: Iterable<T | undefined | null>): number | undefined;

/**
 * Compute the standard deviation, defined as the square root of the bias-corrected variance, of the given array,
 * using the given accessor to convert values to numbers.
 */
export function deviation<T>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => number | undefined | null): number | undefined;

/**
 * Compute an unbiased estimator of the population variance of the given array of numbers.
 */
export function variance<T extends Numeric>(array: Iterable<T | undefined | null>): number | undefined;

/**
 * Compute an unbiased estimator of the population variance of the given array,
 * using the given accessor to convert values to numbers.
 */
export function variance<T>(array: Iterable<T>, accessor: (datum: T, index: number, array: Iterable<T>) => number | undefined | null): number | undefined;

// --------------------------------------------------------------------------------------
// Searching Arrays
// --------------------------------------------------------------------------------------

export function scan(array: Iterable<number>, comparator?: (a: number, b: number) => number): number | undefined;
export function scan<T>(array: Iterable<T>, comparator: (a: T, b: T) => number): number | undefined;

export function bisectLeft(array: ArrayLike<number>, x: number, lo?: number, hi?: number): number;
export function bisectLeft(array: ArrayLike<string>, x: string, lo?: number, hi?: number): number;
export function bisectLeft(array: ArrayLike<Date>, x: Date, lo?: number, hi?: number): number;

export function bisectRight(array: ArrayLike<number>, x: number, lo?: number, hi?: number): number;
export function bisectRight(array: ArrayLike<string>, x: string, lo?: number, hi?: number): number;
export function bisectRight(array: ArrayLike<Date>, x: Date, lo?: number, hi?: number): number;

export const bisect: typeof bisectRight;

export interface Bisector<T, U> {
    left(array: ArrayLike<T>, x: U, lo?: number, hi?: number): number;
    right(array: ArrayLike<T>, x: U, lo?: number, hi?: number): number;
}

export function bisector<T, U>(comparator: (a: T, b: U) => number): Bisector<T, U>;
export function bisector<T, U>(accessor: (x: T) => U): Bisector<T, U>;

/**
 * Rearranges items so that all items in the [left, k] are the smallest. The k-th element will have the (k - left + 1)-th smallest value in [left, right].
 *
 * @param array The array to partially sort (in place).
 * @param k The middle index for partial sorting.
 */
export function quickselect<T>(array: ArrayLike<T>, k: number): T[];

/**
 * Rearranges items so that all items in the [left, k] are the smallest. The k-th element will have the (k - left + 1)-th smallest value in [left, right].
 *
 * @param array The array to partially sort (in place).
 * @param k The middle index for partial sorting.
 * @param left The left index of the range to sort.
 */
export function quickselect<T>(array: ArrayLike<T>, k: number, left: number): T[];

/**
 * Rearranges items so that all items in the [left, k] are the smallest. The k-th element will have the (k - left + 1)-th smallest value in [left, right].
 *
 * @param array The array to partially sort (in place).
 * @param k The middle index for partial sorting.
 * @param left The left index of the range to sort.
 * @param right The right index.
 */
export function quickselect<T>(array: ArrayLike<T>, k: number, left: number, right: number): T[];

/**
 * Rearranges items so that all items in the [left, k] are the smallest. The k-th element will have the (k - left + 1)-th smallest value in [left, right].
 *
 * @param array The array to partially sort (in place).
 * @param k The middle index for partial sorting.
 * @param left The left index of the range to sort.
 * @param right The right index.
 * @param compare The compare function.
 */
export function quickselect<T>(array: ArrayLike<T>, k: number, left: number, right: number, compare: (a: Primitive | undefined, b: Primitive | undefined) => number): T[];

// NB. this is limited to primitive values due to D3's use of the <, >, and >= operators. Results get weird for object instances.
/**
 * Compares two primitive values for sorting (in ascending order).
 */
export function ascending(a: Primitive | undefined, b: Primitive | undefined): number;

// NB. this is limited to primitive values due to D3's use of the <, >, and >= operators. Results get weird for object instances.
/**
 * Compares two primitive values for sorting (in descending order).
 */
export function descending(a: Primitive | undefined, b: Primitive | undefined): number;

// --------------------------------------------------------------------------------------
// Transforming Arrays
// --------------------------------------------------------------------------------------

/**
 * Groups the specified array of values into a Map from key to array of value.
 * @param a The array to group.
 * @param key The key function.
 */
export function group<TObject, TKey>(a: Iterable<TObject>, key: (value: TObject) => TKey): Map<TKey, TObject[]>;

/**
 * Groups and reduces the specified array of values into a Map from key to value.
 *
 * @param a The array to group.
 * @param reduce The reduce function.
 * @param key The key function.
 */
export function rollup<TObject, TKey, TReduce>(a: Iterable<TObject>, reduce: (value: TObject[]) => TReduce, key: (value: TObject) => TKey): Map<TKey, TReduce>;

/**
 * Returns the Cartesian product of the two arrays a and b.
 * For each element i in the specified array a and each element j in the specified array b, in order,
 * it creates a two-element array for each pair.
 *
 * @param a First input array.
 * @param b Second input array.
 */
export function cross<S, T>(a: Iterable<S>, b: Iterable<T>): Array<[S, T]>;

/**
 * Returns the Cartesian product of the two arrays a and b.
 * For each element i in the specified array a and each element j in the specified array b, in order,
 * invokes the specified reducer function passing the element i and element j.
 *
 * @param a First input array.
 * @param b Second input array.
 * @param reducer A reducer function taking as input an element from "a" and "b" and returning a reduced value.
 */
export function cross<S, T, U>(a: Iterable<S>, b: Iterable<T>, reducer: (a: S, b: T) => U): U[];

/**
 * Merges the specified arrays into a single array.
 */
export function merge<T>(arrays: Iterable<Iterable<T>>): T[];

/**
 * For each adjacent pair of elements in the specified array, returns a new array of tuples of elements i and i - 1.
 * Returns the empty array if the input array has fewer than two elements.
 *
 * @param array Array of input elements
 */
export function pairs<T>(array: Iterable<T>): Array<[T, T]>;
/**
 * For each adjacent pair of elements in the specified array, in order, invokes the specified reducer function passing the element i and element i - 1.
 * Returns the resulting array of pair-wise reduced elements.
 * Returns the empty array if the input array has fewer than two elements.
 *
 * @param array Array of input elements
 * @param reducer A reducer function taking as input to adjacent elements of the input array and returning a reduced value.
 */
export function pairs<T, U>(array: Iterable<T>, reducer: (a: T, b: T) => U): U[];

/**
 * Returns a permutation of the specified array using the specified array of indexes.
 * The returned array contains the corresponding element in array for each index in indexes, in order.
 * For example, `permute(["a", "b", "c"], [1, 2, 0]) // ["b", "c", "a"]`
 */
export function permute<T>(array: { [key: number]: T }, keys: ArrayLike<number>): T[];

/**
 * Extract the values from an object into an array with a stable order. For example:
 * `var object = {yield: 27, year: 1931, site: "University Farm"};`
 * `d3.permute(object, ["site", "yield"]); // ["University Farm", 27]`
 */
export function permute<T, K extends keyof T>(object: T, keys: ArrayLike<K>): Array<T[K]>;

/**
 * Generates a 0-based numeric sequence. The output range does not include 'stop'.
 */
export function range(stop: number): number[];

/**
 * Generates a numeric sequence starting from the given start and stop values. 'step' defaults to 1. The output range does not include 'stop'.
 */
export function range(start: number, stop: number, step?: number): number[];

/**
 * Randomizes the order of the specified array using the Fisher–Yates shuffle.
 */
export function shuffle<T>(array: T[], lo?: number, hi?: number): T[];
export function shuffle(array: Int8Array, lo?: number, hi?: number): Int8Array;
export function shuffle(array: Uint8Array, lo?: number, hi?: number): Uint8Array;
export function shuffle(array: Uint8ClampedArray, lo?: number, hi?: number): Uint8ClampedArray;
export function shuffle(array: Int16Array, lo?: number, hi?: number): Int16Array;
export function shuffle(array: Uint16Array, lo?: number, hi?: number): Uint16Array;
export function shuffle(array: Int32Array, lo?: number, hi?: number): Int32Array;
export function shuffle(array: Uint32Array, lo?: number, hi?: number): Uint32Array;
export function shuffle(array: Float32Array, lo?: number, hi?: number): Float32Array;
export function shuffle(array: Float64Array, lo?: number, hi?: number): Float64Array;

/**
 * Generate an array of approximately count + 1 uniformly-spaced, nicely-rounded values between start and stop (inclusive).
 * Each value is a power of ten multiplied by 1, 2 or 5. See also d3.tickIncrement, d3.tickStep and linear.ticks.
 *
 * Ticks are inclusive in the sense that they may include the specified start and stop values if (and only if) they are exact,
 * nicely-rounded values consistent with the inferred step. More formally, each returned tick t satisfies start ≤ t and t ≤ stop.
 *
 * @param start Start value for ticks
 * @param stop Stop value for ticks
 * @param count count + 1 is the approximate number of ticks to be returned by d3.ticks.
 */
export function ticks(start: number, stop: number, count: number): number[];

/**
 * Returns the difference between adjacent tick values if the same arguments were passed to d3.ticks:
 * a nicely-rounded value that is a power of ten multiplied by 1, 2 or 5.
 *
 * Like d3.tickStep, except requires that start is always less than or equal to step, and if the tick step for the given start,
 * stop and count would be less than one, returns the negative inverse tick step instead.
 *
 * This method is always guaranteed to return an integer, and is used by d3.ticks to avoid guarantee that the returned tick values
 * are represented as precisely as possible in IEEE 754 floating point.
 *
 * @param start Start value for ticks
 * @param stop Stop value for ticks
 * @param count count + 1 is the approximate number of ticks to be returned by d3.ticks.
 */
export function tickIncrement(start: number, stop: number, count: number): number;

/**
 * Returns the difference between adjacent tick values if the same arguments were passed to d3.ticks:
 * a nicely-rounded value that is a power of ten multiplied by 1, 2 or 5.
 *
 * Note that due to the limited precision of IEEE 754 floating point, the returned value may not be exact decimals;
 * use d3-format to format numbers for human consumption.
 *
 * @param start Start value for ticks
 * @param stop Stop value for ticks
 * @param count count + 1 is the approximate number of ticks to be returned by d3.ticks.
 */
export function tickStep(start: number, stop: number, count: number): number;

/**
 * Transpose a matrix provided in Array of Arrays format.
 */
export function transpose<T>(matrix: ArrayLike<ArrayLike<T>>): T[][];

/**
 * Returns an array of arrays, where the ith array contains the ith element from each of the argument arrays.
 * The returned array is truncated in length to the shortest array in arrays. If arrays contains only a single array, the returned array
 * contains one-element arrays. With no arguments, the returned array is empty.
 */
export function zip<T>(...arrays: Array<ArrayLike<T>>): T[][];

// --------------------------------------------------------------------------------------
// Histogram
// --------------------------------------------------------------------------------------

export interface Bin<Datum, Value extends number | Date | undefined> extends Array<Datum> {
    x0: Value | undefined;
    x1: Value | undefined;
}

/**
 * Type definition for threshold generator which returns the count of recommended thresholds
 */
export type ThresholdCountGenerator<Value extends number | undefined = number | undefined> =
    (values: ArrayLike<Value>, min: number, max: number) => number;

/**
 * Type definition for threshold generator which returns an array of recommended numbers thresholds
 */
export type ThresholdNumberArrayGenerator<Value extends number | undefined> =
    (values: ArrayLike<Value>, min: number, max: number) => Value[];

/**
 * Type definition for threshold generator which returns an array of recommended dates thresholds
 */
export type ThresholdDateArrayGenerator<Value extends Date | undefined> =
    (values: ArrayLike<Value>, min: Date, max: Date) => Value[];

export interface HistogramCommon<Datum, Value extends number | Date | undefined> {
    (data: ArrayLike<Datum>): Array<Bin<Datum, Value>>;

    value(): (d: Datum, i: number, data: ArrayLike<Datum>) => Value;
    value(valueAccessor: (d: Datum, i: number, data: ArrayLike<Datum>) => Value): this;
}

export interface HistogramGeneratorDate<Datum, Value extends Date | undefined> extends HistogramCommon<Datum, Date> {
    domain(): (values: ArrayLike<Value>) => [Date, Date];
    domain(domain: [Date, Date]): this;
    domain(domainAccessor: (values: ArrayLike<Value>) => [Date, Date]): this;

    thresholds(): ThresholdDateArrayGenerator<Value>;
    /**
     * Set the array of values to be used as thresholds in determining the bins.
     *
     * Any threshold values outside the domain are ignored. The first bin.x0 is always equal to the minimum domain value,
     * and the last bin.x1 is always equal to the maximum domain value.
     *
     * @param thresholds Array of threshold values used for binning. The elements must
     * be of the same type as the materialized values of the histogram.
     */
    thresholds(thresholds: ArrayLike<Value>): this;
    /**
     * Set a threshold accessor function, which returns the array of values to be used as
     * thresholds in determining the bins.
     *
     * Any threshold values outside the domain are ignored. The first bin.x0 is always equal to the minimum domain value,
     * and the last bin.x1 is always equal to the maximum domain value.
     *
     * @param thresholds A function which accepts as arguments the array of materialized values, and
     * optionally the domain minimum and maximum. The function calculates and returns the array of values to be used as
     * thresholds in determining the bins.
     */
    thresholds(thresholds: ThresholdDateArrayGenerator<Value>): this;
}

export interface HistogramGeneratorNumber<Datum, Value extends number | undefined> extends HistogramCommon<Datum, Value> {
    domain(): (values: Iterable<Value>) => [number, number] | [undefined, undefined];
    domain(domain: [number, number]): this;
    domain(domainAccessor: (values: Iterable<Value>) => [number, number] | [undefined, undefined]): this;

    thresholds(): ThresholdCountGenerator<Value> | ThresholdNumberArrayGenerator<Value>;
    /**
     * Divide the domain uniformly into approximately count bins. IMPORTANT: This threshold
     * setting approach only works, when the materialized values are numbers!
     *
     * Any threshold values outside the domain are ignored. The first bin.x0 is always equal to the minimum domain value,
     * and the last bin.x1 is always equal to the maximum domain value.
     *
     * @param count The desired number of uniform bins.
     */
    thresholds(count: number): this;
    /**
     * Set a threshold accessor function, which returns the desired number of bins.
     * Divides the domain uniformly into approximately count bins. IMPORTANT: This threshold
     * setting approach only works, when the materialized values are numbers!
     *
     * Any threshold values outside the domain are ignored. The first bin.x0 is always equal to the minimum domain value,
     * and the last bin.x1 is always equal to the maximum domain value.
     *
     * @param count A function which accepts as arguments the array of materialized values, and
     * optionally the domain minimum and maximum. The function calculates and returns the suggested
     * number of bins.
     */
    thresholds(count: ThresholdCountGenerator<Value>): this;
    /**
     * Set the array of values to be used as thresholds in determining the bins.
     *
     * Any threshold values outside the domain are ignored. The first bin.x0 is always equal to the minimum domain value,
     * and the last bin.x1 is always equal to the maximum domain value.
     *
     * @param thresholds Array of threshold values used for binning. The elements must
     * be of the same type as the materialized values of the histogram.
     */
    thresholds(thresholds: ArrayLike<Value>): this;
    /**
     * Set a threshold accessor function, which returns the array of values to be used as
     * thresholds in determining the bins.
     *
     * Any threshold values outside the domain are ignored. The first bin.x0 is always equal to the minimum domain value,
     * and the last bin.x1 is always equal to the maximum domain value.
     *
     * @param thresholds A function which accepts as arguments the array of materialized values, and
     * optionally the domain minimum and maximum. The function calculates and returns the array of values to be used as
     * thresholds in determining the bins.
     */
    thresholds(thresholds: ThresholdNumberArrayGenerator<Value>): this;
}

export function histogram(): HistogramGeneratorNumber<number, number>;
export function histogram<Datum, Value extends number | undefined>(): HistogramGeneratorNumber<Datum, Value>;
export function histogram<Datum, Value extends Date | undefined>(): HistogramGeneratorDate<Datum, Value>;

// --------------------------------------------------------------------------------------
// Histogram Thresholds
// --------------------------------------------------------------------------------------

export function thresholdFreedmanDiaconis(values: ArrayLike<number | undefined>, min: number, max: number): number; // of type ThresholdCountGenerator

export function thresholdScott(values: ArrayLike<number | undefined>, min: number, max: number): number; // of type ThresholdCountGenerator

export function thresholdSturges(values: ArrayLike<number | undefined>): number; // of type ThresholdCountGenerator
