// @flow

import { OverscaledTileID } from './tile_id';
import type Tile from './tile';

/**
 * A [least-recently-used cache](http://en.wikipedia.org/wiki/Cache_algorithms)
 * with hash lookup made possible by keeping a list of keys in parallel to
 * an array of dictionary of values
 *
 * @private
 */
class TileCache {
    max: number;
    data: {[key: number | string]: Array<{ value: Tile, timeout: ?TimeoutID}>};
    order: Array<number>;
    onRemove: (element: Tile) => void;
    /**
     * @param {number} max number of permitted values
     * @param {Function} onRemove callback called with items when they expire
     */
    constructor(max: number, onRemove: (element: Tile) => void) {
        this.max = max;
        this.onRemove = onRemove;
        this.reset();
    }

    /**
     * Clear the cache
     *
     * @returns {TileCache} this cache
     * @private
     */
    reset() {
        for (const key in this.data) {
            for (const removedData of this.data[key]) {
                if (removedData.timeout) clearTimeout(removedData.timeout);
                this.onRemove(removedData.value);
            }
        }

        this.data = {};
        this.order = [];

        return this;
    }

    /**
     * Add a key, value combination to the cache, trimming its size if this pushes
     * it over max length.
     *
     * @param {OverscaledTileID} tileID lookup key for the item
     * @param {*} data any value
     *
     * @returns {TileCache} this cache
     * @private
     */
    add(tileID: OverscaledTileID, data: Tile, expiryTimeout: number | void) {
        const key = tileID.wrapped().key;
        if (this.data[key] === undefined) {
            this.data[key] = [];
        }

        const dataWrapper = {
            value: data,
            timeout: undefined
        };

        if (expiryTimeout !== undefined) {
            dataWrapper.timeout = setTimeout(() => {
                this.remove(tileID, dataWrapper);
            }, expiryTimeout);
        }

        this.data[key].push(dataWrapper);
        this.order.push(key);

        if (this.order.length > this.max) {
            const removedData = this._getAndRemoveByKey(this.order[0]);
            if (removedData) this.onRemove(removedData);
        }

        return this;
    }

    /**
     * Determine whether the value attached to `key` is present
     *
     * @param {OverscaledTileID} tileID the key to be looked-up
     * @returns {boolean} whether the cache has this value
     * @private
     */
    has(tileID: OverscaledTileID): boolean {
        return tileID.wrapped().key in this.data;
    }

    /**
     * Get the value attached to a specific key and remove data from cache.
     * If the key is not found, returns `null`
     *
     * @param {OverscaledTileID} tileID the key to look up
     * @returns {*} the data, or null if it isn't found
     * @private
     */
    getAndRemove(tileID: OverscaledTileID): ?Tile {
        if (!this.has(tileID)) { return null; }
        return this._getAndRemoveByKey(tileID.wrapped().key);
    }

    /*
     * Get and remove the value with the specified key.
     */
    _getAndRemoveByKey(key: number): ?Tile {
        const data = this.data[key].shift();
        if (data.timeout) clearTimeout(data.timeout);

        if (this.data[key].length === 0) {
            delete this.data[key];
        }
        this.order.splice(this.order.indexOf(key), 1);

        return data.value;
    }

    /**
     * Get the value attached to a specific key without removing data
     * from the cache. If the key is not found, returns `null`
     *
     * @param {OverscaledTileID} tileID the key to look up
     * @returns {*} the data, or null if it isn't found
     * @private
     */
    get(tileID: OverscaledTileID): ?Tile {
        if (!this.has(tileID)) { return null; }

        const data = this.data[tileID.wrapped().key][0];
        return data.value;
    }

    /**
     * Remove a key/value combination from the cache.
     *
     * @param {OverscaledTileID} tileID the key for the pair to delete
     * @param {Tile} value If a value is provided, remove that exact version of the value.
     * @returns {TileCache} this cache
     * @private
     */
    remove(tileID: OverscaledTileID, value: ?{ value: Tile, timeout: ?TimeoutID}) {
        if (!this.has(tileID)) { return this; }
        const key = tileID.wrapped().key;

        const dataIndex = value === undefined ? 0 : this.data[key].indexOf(value);
        const data = this.data[key][dataIndex];
        this.data[key].splice(dataIndex, 1);
        if (data.timeout) clearTimeout(data.timeout);
        if (this.data[key].length === 0) {
            delete this.data[key];
        }
        this.onRemove(data.value);
        this.order.splice(this.order.indexOf(key), 1);

        return this;
    }

    /**
     * Change the max size of the cache.
     *
     * @param {number} max the max size of the cache
     * @returns {TileCache} this cache
     * @private
     */
    setMaxSize(max: number): TileCache {
        this.max = max;

        while (this.order.length > this.max) {
            const removedData = this._getAndRemoveByKey(this.order[0]);
            if (removedData) this.onRemove(removedData);
        }

        return this;
    }
}

export default TileCache;
