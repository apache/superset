// @flow

import UnitBezier from '@mapbox/unitbezier';

import Point from '@mapbox/point-geometry';
import window from './window';

import type {Callback} from '../types/callback';

/**
 * @module util
 * @private
 */

/**
 * Given a value `t` that varies between 0 and 1, return
 * an interpolation function that eases between 0 and 1 in a pleasing
 * cubic in-out fashion.
 *
 * @private
 */
export function easeCubicInOut(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const t2 = t * t,
        t3 = t2 * t;
    return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
}

/**
 * Given given (x, y), (x1, y1) control points for a bezier curve,
 * return a function that interpolates along that curve.
 *
 * @param p1x control point 1 x coordinate
 * @param p1y control point 1 y coordinate
 * @param p2x control point 2 x coordinate
 * @param p2y control point 2 y coordinate
 * @private
 */
export function bezier(p1x: number, p1y: number, p2x: number, p2y: number): (t: number) => number {
    const bezier = new UnitBezier(p1x, p1y, p2x, p2y);
    return function(t: number) {
        return bezier.solve(t);
    };
}

/**
 * A default bezier-curve powered easing function with
 * control points (0.25, 0.1) and (0.25, 1)
 *
 * @private
 */
export const ease = bezier(0.25, 0.1, 0.25, 1);

/**
 * constrain n to the given range via min + max
 *
 * @param n value
 * @param min the minimum value to be returned
 * @param max the maximum value to be returned
 * @returns the clamped value
 * @private
 */
export function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

/**
 * constrain n to the given range, excluding the minimum, via modular arithmetic
 *
 * @param n value
 * @param min the minimum value to be returned, exclusive
 * @param max the maximum value to be returned, inclusive
 * @returns constrained number
 * @private
 */
export function wrap(n: number, min: number, max: number): number {
    const d = max - min;
    const w = ((n - min) % d + d) % d + min;
    return (w === min) ? max : w;
}

/*
 * Call an asynchronous function on an array of arguments,
 * calling `callback` with the completed results of all calls.
 *
 * @param array input to each call of the async function.
 * @param fn an async function with signature (data, callback)
 * @param callback a callback run after all async work is done.
 * called with an array, containing the results of each async call.
 * @private
 */
export function asyncAll<Item, Result>(
    array: Array<Item>,
    fn: (item: Item, fnCallback: Callback<Result>) => void,
    callback: Callback<Array<Result>>
) {
    if (!array.length) { return callback(null, []); }
    let remaining = array.length;
    const results = new Array(array.length);
    let error = null;
    array.forEach((item, i) => {
        fn(item, (err, result) => {
            if (err) error = err;
            results[i] = ((result: any): Result); // https://github.com/facebook/flow/issues/2123
            if (--remaining === 0) callback(error, results);
        });
    });
}

/*
 * Polyfill for Object.values. Not fully spec compliant, but we don't
 * need it to be.
 *
 * @private
 */
export function values<T>(obj: {[key: string]: T}): Array<T> {
    const result = [];
    for (const k in obj) {
        result.push(obj[k]);
    }
    return result;
}

/*
 * Compute the difference between the keys in one object and the keys
 * in another object.
 *
 * @returns keys difference
 * @private
 */
export function keysDifference<S, T>(obj: {[key: string]: S}, other: {[key: string]: T}): Array<string> {
    const difference = [];
    for (const i in obj) {
        if (!(i in other)) {
            difference.push(i);
        }
    }
    return difference;
}

/**
 * Given a destination object and optionally many source objects,
 * copy all properties from the source objects into the destination.
 * The last source object given overrides properties from previous
 * source objects.
 *
 * @param dest destination object
 * @param sources sources from which properties are pulled
 * @private
 */
export function extend(dest: Object, ...sources: Array<?Object>): Object {
    for (const src of sources) {
        for (const k in src) {
            dest[k] = src[k];
        }
    }
    return dest;
}

/**
 * Given an object and a number of properties as strings, return version
 * of that object with only those properties.
 *
 * @param src the object
 * @param properties an array of property names chosen
 * to appear on the resulting object.
 * @returns object with limited properties.
 * @example
 * var foo = { name: 'Charlie', age: 10 };
 * var justName = pick(foo, ['name']);
 * // justName = { name: 'Charlie' }
 * @private
 */
export function pick(src: Object, properties: Array<string>): Object {
    const result = {};
    for (let i = 0; i < properties.length; i++) {
        const k = properties[i];
        if (k in src) {
            result[k] = src[k];
        }
    }
    return result;
}

let id = 1;

/**
 * Return a unique numeric id, starting at 1 and incrementing with
 * each call.
 *
 * @returns unique numeric id.
 * @private
 */
export function uniqueId(): number {
    return id++;
}

/**
 * Return a random UUID (v4). Taken from: https://gist.github.com/jed/982883
 * @private
 */
export function uuid(): string {
    function b(a) {
        return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) :
        //$FlowFixMe: Flow doesn't like the implied array literal conversion here
            ([1e7] + -[1e3] + -4e3 + -8e3 + -1e11).replace(/[018]/g, b);
    }
    return b();
}

/**
 * Validate a string to match UUID(v4) of the
 * form: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
 * @param str string to validate.
 * @private
 */
export function validateUuid(str: ?string): boolean {
    return str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str) : false;
}

/**
 * Given an array of member function names as strings, replace all of them
 * with bound versions that will always refer to `context` as `this`. This
 * is useful for classes where otherwise event bindings would reassign
 * `this` to the evented object or some other value: this lets you ensure
 * the `this` value always.
 *
 * @param fns list of member function names
 * @param context the context value
 * @example
 * function MyClass() {
 *   bindAll(['ontimer'], this);
 *   this.name = 'Tom';
 * }
 * MyClass.prototype.ontimer = function() {
 *   alert(this.name);
 * };
 * var myClass = new MyClass();
 * setTimeout(myClass.ontimer, 100);
 * @private
 */
export function bindAll(fns: Array<string>, context: Object): void {
    fns.forEach((fn) => {
        if (!context[fn]) { return; }
        context[fn] = context[fn].bind(context);
    });
}

/**
 * Determine if a string ends with a particular substring
 *
 * @private
 */
export function endsWith(string: string, suffix: string): boolean {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
}

/**
 * Create an object by mapping all the values of an existing object while
 * preserving their keys.
 *
 * @private
 */
export function mapObject(input: Object, iterator: Function, context?: Object): Object {
    const output = {};
    for (const key in input) {
        output[key] = iterator.call(context || this, input[key], key, input);
    }
    return output;
}

/**
 * Create an object by filtering out values of an existing object.
 *
 * @private
 */
export function filterObject(input: Object, iterator: Function, context?: Object): Object {
    const output = {};
    for (const key in input) {
        if (iterator.call(context || this, input[key], key, input)) {
            output[key] = input[key];
        }
    }
    return output;
}

import deepEqual from '../style-spec/util/deep_equal';
export { deepEqual };

/**
 * Deeply clones two objects.
 *
 * @private
 */
export function clone<T>(input: T): T {
    if (Array.isArray(input)) {
        return input.map(clone);
    } else if (typeof input === 'object' && input) {
        return ((mapObject(input, clone): any): T);
    } else {
        return input;
    }
}

/**
 * Check if two arrays have at least one common element.
 *
 * @private
 */
export function arraysIntersect<T>(a: Array<T>, b: Array<T>): boolean {
    for (let l = 0; l < a.length; l++) {
        if (b.indexOf(a[l]) >= 0) return true;
    }
    return false;
}

/**
 * Print a warning message to the console and ensure duplicate warning messages
 * are not printed.
 *
 * @private
 */
const warnOnceHistory: {[key: string]: boolean} = {};

export function warnOnce(message: string): void {
    if (!warnOnceHistory[message]) {
        // console isn't defined in some WebWorkers, see #2558
        if (typeof console !== "undefined") console.warn(message);
        warnOnceHistory[message] = true;
    }
}

/**
 * Indicates if the provided Points are in a counter clockwise (true) or clockwise (false) order
 *
 * @private
 * @returns true for a counter clockwise set of points
 */
// http://bryceboe.com/2006/10/23/line-segment-intersection-algorithm/
export function isCounterClockwise(a: Point, b: Point, c: Point): boolean {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

/**
 * Returns the signed area for the polygon ring.  Postive areas are exterior rings and
 * have a clockwise winding.  Negative areas are interior rings and have a counter clockwise
 * ordering.
 *
 * @private
 * @param ring Exterior or interior ring
 */
export function calculateSignedArea(ring: Array<Point>): number {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
}

/**
 * Detects closed polygons, first + last point are equal
 *
 * @private
 * @param points array of points
 * @return true if the points are a closed polygon
 */
export function isClosedPolygon(points: Array<Point>): boolean {
    // If it is 2 points that are the same then it is a point
    // If it is 3 points with start and end the same then it is a line
    if (points.length < 4)
        return false;

    const p1 = points[0];
    const p2 = points[points.length - 1];

    if (Math.abs(p1.x - p2.x) > 0 ||
        Math.abs(p1.y - p2.y) > 0) {
        return false;
    }

    // polygon simplification can produce polygons with zero area and more than 3 points
    return Math.abs(calculateSignedArea(points)) > 0.01;
}

/**
 * Converts spherical coordinates to cartesian coordinates.
 *
 * @private
 * @param spherical Spherical coordinates, in [radial, azimuthal, polar]
 * @return cartesian coordinates in [x, y, z]
 */

export function sphericalToCartesian([r, azimuthal, polar]: [number, number, number]): {x: number, y: number, z: number} {
    // We abstract "north"/"up" (compass-wise) to be 0° when really this is 90° (π/2):
    // correct for that here
    azimuthal += 90;

    // Convert azimuthal and polar angles to radians
    azimuthal *= Math.PI / 180;
    polar *= Math.PI / 180;

    return {
        x: r * Math.cos(azimuthal) * Math.sin(polar),
        y: r * Math.sin(azimuthal) * Math.sin(polar),
        z: r * Math.cos(polar)
    };
}

/**
 * Parses data from 'Cache-Control' headers.
 *
 * @private
 * @param cacheControl Value of 'Cache-Control' header
 * @return object containing parsed header info.
 */

export function parseCacheControl(cacheControl: string): Object {
    // Taken from [Wreck](https://github.com/hapijs/wreck)
    const re = /(?:^|(?:\s*\,\s*))([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)(?:\=(?:([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)|(?:\"((?:[^"\\]|\\.)*)\")))?/g;

    const header = {};
    cacheControl.replace(re, ($0, $1, $2, $3) => {
        const value = $2 || $3;
        header[$1] = value ? value.toLowerCase() : true;
        return '';
    });

    if (header['max-age']) {
        const maxAge = parseInt(header['max-age'], 10);
        if (isNaN(maxAge)) delete header['max-age'];
        else header['max-age'] = maxAge;
    }

    return header;
}

export function storageAvailable(type: string): boolean {
    try {
        const storage = window[type];
        storage.setItem('_mapbox_test_', 1);
        storage.removeItem('_mapbox_test_');
        return true;
    } catch (e) {
        return false;
    }
}
