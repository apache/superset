// @flow

import { clamp } from '../util/util';

/**
 * Packs two numbers, interpreted as 8-bit unsigned integers, into a single
 * float.  Unpack them in the shader using the `unpack_float()` function,
 * defined in _prelude.vertex.glsl
 *
 * @private
 */
export function packUint8ToFloat(a: number, b: number) {
    // coerce a and b to 8-bit ints
    a = clamp(Math.floor(a), 0, 255);
    b = clamp(Math.floor(b), 0, 255);
    return 256 * a + b;
}
