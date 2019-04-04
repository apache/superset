// @flow

import { warnOnce } from '../util/util';

import type Context from '../gl/context';

/**
 * A LineAtlas lets us reuse rendered dashed lines
 * by writing many of them to a texture and then fetching their positions
 * using .getDash.
 *
 * @param {number} width
 * @param {number} height
 * @private
 */
class LineAtlas {
    width: number;
    height: number;
    nextRow: number;
    bytes: number;
    data: Uint8Array;
    positions: {[string]: any};
    dirty: boolean;
    texture: WebGLTexture;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.nextRow = 0;

        this.bytes = 4;
        this.data = new Uint8Array(this.width * this.height * this.bytes);

        this.positions = {};
    }

    /**
     * Get or create a dash line pattern.
     *
     * @param {Array<number>} dasharray
     * @param {boolean} round whether to add circle caps in between dash segments
     * @returns {Object} position of dash texture in { y, height, width }
     * @private
     */
    getDash(dasharray: Array<number>, round: boolean) {
        const key = dasharray.join(",") + String(round);

        if (!this.positions[key]) {
            this.positions[key] = this.addDash(dasharray, round);
        }
        return this.positions[key];
    }

    addDash(dasharray: Array<number>, round: boolean) {

        const n = round ? 7 : 0;
        const height = 2 * n + 1;
        const offset = 128;

        if (this.nextRow + height > this.height) {
            warnOnce('LineAtlas out of space');
            return null;
        }

        let length = 0;
        for (let i = 0; i < dasharray.length; i++) {
            length += dasharray[i];
        }

        const stretch = this.width / length;
        const halfWidth = stretch / 2;

        // If dasharray has an odd length, both the first and last parts
        // are dashes and should be joined seamlessly.
        const oddLength = dasharray.length % 2 === 1;

        for (let y = -n; y <= n; y++) {
            const row = this.nextRow + n + y;
            const index = this.width * row;

            let left = oddLength ? -dasharray[dasharray.length - 1] : 0;
            let right = dasharray[0];
            let partIndex = 1;

            for (let x = 0; x < this.width; x++) {

                while (right < x / stretch) {
                    left = right;
                    right = right + dasharray[partIndex];

                    if (oddLength && partIndex === dasharray.length - 1) {
                        right += dasharray[0];
                    }

                    partIndex++;
                }

                const distLeft = Math.abs(x - left * stretch);
                const distRight = Math.abs(x - right * stretch);
                const dist = Math.min(distLeft, distRight);
                const inside = (partIndex % 2) === 1;
                let signedDistance;

                if (round) {
                    // Add circle caps
                    const distMiddle = n ? y / n * (halfWidth + 1) : 0;
                    if (inside) {
                        const distEdge = halfWidth - Math.abs(distMiddle);
                        signedDistance = Math.sqrt(dist * dist + distEdge * distEdge);
                    } else {
                        signedDistance = halfWidth - Math.sqrt(dist * dist + distMiddle * distMiddle);
                    }
                } else {
                    signedDistance = (inside ? 1 : -1) * dist;
                }

                this.data[3 + (index + x) * 4] = Math.max(0, Math.min(255, signedDistance + offset));
            }
        }

        const pos = {
            y: (this.nextRow + n + 0.5) / this.height,
            height: 2 * n / this.height,
            width: length
        };

        this.nextRow += height;
        this.dirty = true;

        return pos;
    }

    bind(context: Context) {
        const gl = context.gl;
        if (!this.texture) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.data);

        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);

            if (this.dirty) {
                this.dirty = false;
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.data);
            }
        }
    }
}

export default LineAtlas;
