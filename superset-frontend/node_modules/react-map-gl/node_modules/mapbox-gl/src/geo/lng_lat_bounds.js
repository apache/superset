// @flow

import LngLat from './lng_lat';

import type {LngLatLike} from './lng_lat';

/**
 * A `LngLatBounds` object represents a geographical bounding box,
 * defined by its southwest and northeast points in longitude and latitude.
 *
 * If no arguments are provided to the constructor, a `null` bounding box is created.
 *
 * Note that any Mapbox GL method that accepts a `LngLatBounds` object as an argument or option
 * can also accept an `Array` of two {@link LngLatLike} constructs and will perform an implicit conversion.
 * This flexible type is documented as {@link LngLatBoundsLike}.
 *
 * @param {LngLatLike} [sw] The southwest corner of the bounding box.
 * @param {LngLatLike} [ne] The northeast corner of the bounding box.
 * @example
 * var sw = new mapboxgl.LngLat(-73.9876, 40.7661);
 * var ne = new mapboxgl.LngLat(-73.9397, 40.8002);
 * var llb = new mapboxgl.LngLatBounds(sw, ne);
 */
class LngLatBounds {
    _ne: LngLat;
    _sw: LngLat;

    // This constructor is too flexible to type. It should not be so flexible.
    constructor(sw: any, ne: any) {
        if (!sw) {
            // noop
        } else if (ne) {
            this.setSouthWest(sw).setNorthEast(ne);
        } else if (sw.length === 4) {
            this.setSouthWest([sw[0], sw[1]]).setNorthEast([sw[2], sw[3]]);
        } else {
            this.setSouthWest(sw[0]).setNorthEast(sw[1]);
        }
    }

    /**
     * Set the northeast corner of the bounding box
     *
     * @param {LngLatLike} ne
     * @returns {LngLatBounds} `this`
     */
    setNorthEast(ne: LngLatLike) {
        this._ne = ne instanceof LngLat ? new LngLat(ne.lng, ne.lat) : LngLat.convert(ne);
        return this;
    }

    /**
     * Set the southwest corner of the bounding box
     *
     * @param {LngLatLike} sw
     * @returns {LngLatBounds} `this`
     */
    setSouthWest(sw: LngLatLike) {
        this._sw = sw instanceof LngLat ? new LngLat(sw.lng, sw.lat) : LngLat.convert(sw);
        return this;
    }

    /**
     * Extend the bounds to include a given LngLat or LngLatBounds.
     *
     * @param {LngLat|LngLatBounds} obj object to extend to
     * @returns {LngLatBounds} `this`
     */
    extend(obj: LngLat | LngLatBounds) {
        const sw = this._sw,
            ne = this._ne;
        let sw2, ne2;

        if (obj instanceof LngLat) {
            sw2 = obj;
            ne2 = obj;

        } else if (obj instanceof LngLatBounds) {
            sw2 = obj._sw;
            ne2 = obj._ne;

            if (!sw2 || !ne2) return this;

        } else {
            if (Array.isArray(obj)) {
                if (obj.every(Array.isArray)) {
                    return this.extend(LngLatBounds.convert(obj));
                } else {
                    return this.extend(LngLat.convert(obj));
                }
            }
            return this;
        }

        if (!sw && !ne) {
            this._sw = new LngLat(sw2.lng, sw2.lat);
            this._ne = new LngLat(ne2.lng, ne2.lat);

        } else {
            sw.lng = Math.min(sw2.lng, sw.lng);
            sw.lat = Math.min(sw2.lat, sw.lat);
            ne.lng = Math.max(ne2.lng, ne.lng);
            ne.lat = Math.max(ne2.lat, ne.lat);
        }

        return this;
    }

    /**
     * Returns the geographical coordinate equidistant from the bounding box's corners.
     *
     * @returns {LngLat} The bounding box's center.
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getCenter(); // = LngLat {lng: -73.96365, lat: 40.78315}
     */
    getCenter(): LngLat {
        return new LngLat((this._sw.lng + this._ne.lng) / 2, (this._sw.lat + this._ne.lat) / 2);
    }

    /**
     * Returns the southwest corner of the bounding box.
     *
     * @returns {LngLat} The southwest corner of the bounding box.
     */
    getSouthWest(): LngLat { return this._sw; }

    /**
    * Returns the northeast corner of the bounding box.
    *
    * @returns {LngLat} The northeast corner of the bounding box.
     */
    getNorthEast(): LngLat { return this._ne; }

    /**
    * Returns the northwest corner of the bounding box.
    *
    * @returns {LngLat} The northwest corner of the bounding box.
     */
    getNorthWest(): LngLat { return new LngLat(this.getWest(), this.getNorth()); }

    /**
    * Returns the southeast corner of the bounding box.
    *
    * @returns {LngLat} The southeast corner of the bounding box.
     */
    getSouthEast(): LngLat { return new LngLat(this.getEast(), this.getSouth()); }

    /**
    * Returns the west edge of the bounding box.
    *
    * @returns {number} The west edge of the bounding box.
     */
    getWest(): number { return this._sw.lng; }

    /**
    * Returns the south edge of the bounding box.
    *
    * @returns {number} The south edge of the bounding box.
     */
    getSouth(): number { return this._sw.lat; }

    /**
    * Returns the east edge of the bounding box.
    *
    * @returns {number} The east edge of the bounding box.
     */
    getEast(): number { return this._ne.lng; }

    /**
    * Returns the north edge of the bounding box.
    *
    * @returns {number} The north edge of the bounding box.
     */
    getNorth(): number { return this._ne.lat; }

    /**
     * Returns the bounding box represented as an array.
     *
     * @returns {Array<Array<number>>} The bounding box represented as an array, consisting of the
     *   southwest and northeast coordinates of the bounding represented as arrays of numbers.
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toArray(); // = [[-73.9876, 40.7661], [-73.9397, 40.8002]]
     */
    toArray() {
        return [this._sw.toArray(), this._ne.toArray()];
    }

    /**
     * Return the bounding box represented as a string.
     *
     * @returns {string} The bounding box represents as a string of the format
     *   `'LngLatBounds(LngLat(lng, lat), LngLat(lng, lat))'`.
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toString(); // = "LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))"
     */
    toString() {
        return `LngLatBounds(${this._sw.toString()}, ${this._ne.toString()})`;
    }

    /**
     * Check if the bounding box is an empty/`null`-type box.
     *
     * @returns {boolean} True if bounds have been defined, otherwise false.
     */
    isEmpty() {
        return !(this._sw && this._ne);
    }

    /**
     * Converts an array to a `LngLatBounds` object.
     *
     * If a `LngLatBounds` object is passed in, the function returns it unchanged.
     *
     * Internally, the function calls `LngLat#convert` to convert arrays to `LngLat` values.
     *
     * @param {LngLatBoundsLike} input An array of two coordinates to convert, or a `LngLatBounds` object to return.
     * @returns {LngLatBounds} A new `LngLatBounds` object, if a conversion occurred, or the original `LngLatBounds` object.
     * @example
     * var arr = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
     * var llb = mapboxgl.LngLatBounds.convert(arr);
     * llb;   // = LngLatBounds {_sw: LngLat {lng: -73.9876, lat: 40.7661}, _ne: LngLat {lng: -73.9397, lat: 40.8002}}
     */
    static convert(input: LngLatBoundsLike): LngLatBounds {
        if (!input || input instanceof LngLatBounds) return input;
        return new LngLatBounds(input);
    }
}

/**
 * A {@link LngLatBounds} object, an array of {@link LngLatLike} objects in [sw, ne] order,
 * or an array of numbers in [west, south, east, north] order.
 *
 * @typedef {LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number]} LngLatBoundsLike
 * @example
 * var v1 = new mapboxgl.LngLatBounds(
 *   new mapboxgl.LngLat(-73.9876, 40.7661),
 *   new mapboxgl.LngLat(-73.9397, 40.8002)
 * );
 * var v2 = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002])
 * var v3 = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
 */
export type LngLatBoundsLike = LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number];

export default LngLatBounds;
