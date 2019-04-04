// @flow
import { RGBAImage } from '../util/image';

import { warnOnce } from '../util/util';
import { register } from '../util/web_worker_transfer';

// DEMData is a data structure for decoding, backfilling, and storing elevation data for processing in the hillshade shaders
// data can be populated either from a pngraw image tile or from serliazed data sent back from a worker. When data is initially
// loaded from a image tile, we decode the pixel values using the appropriate decoding formula, but we store the
// elevation data as an Int32 value. we add 65536 (2^16) to eliminate negative values and enable the use of
// integer overflow when creating the texture used in the hillshadePrepare step.

// DEMData also handles the backfilling of data from a tile's neighboring tiles. This is necessary because we use a pixel's 8
// surrounding pixel values to compute the slope at that pixel, and we cannot accurately calculate the slope at pixels on a
// tile's edge without backfilling from neighboring tiles.

export default class DEMData {
    uid: string;
    data: Int32Array;
    stride: number;
    dim: number;

    constructor(uid: string, data: RGBAImage, encoding: "mapbox" | "terrarium") {
        this.uid = uid;
        if (data.height !== data.width) throw new RangeError('DEM tiles must be square');
        if (encoding && encoding !== "mapbox" && encoding !== "terrarium") return warnOnce(
            `"${encoding}" is not a valid encoding type. Valid types include "mapbox" and "terrarium".`
        );
        const dim = this.dim = data.height;
        this.stride = this.dim + 2;
        this.data = new Int32Array(this.stride * this.stride);

        const pixels = data.data;
        const unpack = encoding === "terrarium" ? this._unpackTerrarium : this._unpackMapbox;
        for (let y = 0; y < dim; y++) {
            for (let x = 0; x < dim; x++) {
                const i = y * dim + x;
                const j = i * 4;
                this.set(x, y, unpack(pixels[j], pixels[j + 1], pixels[j + 2]));
            }
        }

        // in order to avoid flashing seams between tiles, here we are initially populating a 1px border of pixels around the image
        // with the data of the nearest pixel from the image. this data is eventually replaced when the tile's neighboring
        // tiles are loaded and the accurate data can be backfilled using DEMData#backfillBorder
        for (let x = 0; x < dim; x++) {
            // left vertical border
            this.set(-1, x, this.get(0, x));
            // right vertical border
            this.set(dim, x, this.get(dim - 1, x));
            // left horizontal border
            this.set(x, -1, this.get(x, 0));
            // right horizontal border
            this.set(x, dim, this.get(x, dim - 1));
        }
        // corners
        this.set(-1, -1, this.get(0, 0));
        this.set(dim, -1, this.get(dim - 1, 0));
        this.set(-1, dim, this.get(0, dim - 1));
        this.set(dim, dim, this.get(dim - 1, dim - 1));
    }

    set(x: number, y: number, value: number) {
        this.data[this._idx(x, y)] = value + 65536;
    }

    get(x: number, y: number) {
        return this.data[this._idx(x, y)] - 65536;
    }

    _idx(x: number, y: number) {
        if (x < -1 || x >= this.dim + 1 ||  y < -1 || y >= this.dim + 1) throw new RangeError('out of range source coordinates for DEM data');
        return (y + 1) * this.stride + (x + 1);
    }

    _unpackMapbox(r: number, g: number, b: number) {
        // unpacking formula for mapbox.terrain-rgb:
        // https://www.mapbox.com/help/access-elevation-data/#mapbox-terrain-rgb
        return ((r * 256 * 256 + g * 256.0 + b) / 10.0 - 10000.0);
    }

    _unpackTerrarium(r: number, g: number, b: number) {
        // unpacking formula for mapzen terrarium:
        // https://aws.amazon.com/public-datasets/terrain/
        return ((r * 256 + g + b / 256) - 32768.0);
    }

    getPixels() {
        return new RGBAImage({width: this.stride, height: this.stride}, new Uint8Array(this.data.buffer));
    }

    backfillBorder(borderTile: DEMData, dx: number, dy: number) {
        if (this.dim !== borderTile.dim) throw new Error('dem dimension mismatch');

        let xMin = dx * this.dim,
            xMax = dx * this.dim + this.dim,
            yMin = dy * this.dim,
            yMax = dy * this.dim + this.dim;

        switch (dx) {
        case -1:
            xMin = xMax - 1;
            break;
        case 1:
            xMax = xMin + 1;
            break;
        }

        switch (dy) {
        case -1:
            yMin = yMax - 1;
            break;
        case 1:
            yMax = yMin + 1;
            break;
        }

        const ox = -dx * this.dim;
        const oy = -dy * this.dim;
        for (let y = yMin; y < yMax; y++) {
            for (let x = xMin; x < xMax; x++) {
                this.set(x, y, borderTile.get(x + ox, y + oy));
            }
        }
    }
}

register('DEMData', DEMData);
