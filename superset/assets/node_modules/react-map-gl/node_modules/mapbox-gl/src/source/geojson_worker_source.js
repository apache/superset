// @flow

import { getJSON } from '../util/ajax';

import performance from '../util/performance';
import rewind from 'geojson-rewind';
import GeoJSONWrapper from './geojson_wrapper';
import vtpbf from 'vt-pbf';
import Supercluster from 'supercluster';
import geojsonvt from 'geojson-vt';
import assert from 'assert';
import VectorTileWorkerSource from './vector_tile_worker_source';

import type {
    WorkerTileParameters,
    WorkerTileCallback,
} from '../source/worker_source';

import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';

import type {LoadVectorDataCallback} from './vector_tile_worker_source';
import type { RequestParameters, ResponseCallback } from '../util/ajax';
import type { Callback } from '../types/callback';
import type {GeoJSONFeature} from '@mapbox/geojson-types';

export type LoadGeoJSONParameters = {
    request?: RequestParameters,
    data?: string,
    source: string,
    cluster: boolean,
    superclusterOptions?: Object,
    geojsonVtOptions?: Object
};

export type LoadGeoJSON = (params: LoadGeoJSONParameters, callback: ResponseCallback<Object>) => void;

export interface GeoJSONIndex {
    getTile(z: number, x: number, y: number): Object;

    // supercluster methods
    getClusterExpansionZoom(clusterId: number): number;
    getChildren(clusterId: number): Array<GeoJSONFeature>;
    getLeaves(clusterId: number, limit: number, offset: number): Array<GeoJSONFeature>;
}

function loadGeoJSONTile(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
    const canonical = params.tileID.canonical;

    if (!this._geoJSONIndex) {
        return callback(null, null);  // we couldn't load the file
    }

    const geoJSONTile = this._geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
    if (!geoJSONTile) {
        return callback(null, null); // nothing in the given tile
    }

    const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);

    // Encode the geojson-vt tile into binary vector tile form.  This
    // is a convenience that allows `FeatureIndex` to operate the same way
    // across `VectorTileSource` and `GeoJSONSource` data.
    let pbf = vtpbf(geojsonWrapper);
    if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
        // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
        pbf = new Uint8Array(pbf);
    }

    callback(null, {
        vectorTile: geojsonWrapper,
        rawData: pbf.buffer
    });
}

export type SourceState =
    | 'Idle'            // Source empty or data loaded
    | 'Coalescing'      // Data finished loading, but discard 'loadData' messages until receiving 'coalesced'
    | 'NeedsLoadData';  // 'loadData' received while coalescing, trigger one more 'loadData' on receiving 'coalesced'

/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory GeoJSON
 * representation.  To do so, create it with
 * `new GeoJSONWorkerSource(actor, layerIndex, customLoadGeoJSONFunction)`.
 * For a full example, see [mapbox-gl-topojson](https://github.com/developmentseed/mapbox-gl-topojson).
 *
 * @private
 */
class GeoJSONWorkerSource extends VectorTileWorkerSource {
    loadGeoJSON: LoadGeoJSON;
    _state: SourceState;
    _pendingCallback: Callback<{
        resourceTiming?: {[string]: Array<PerformanceResourceTiming>},
        abandoned?: boolean }>;
    _pendingLoadDataParams: LoadGeoJSONParameters;
    _geoJSONIndex: GeoJSONIndex

    /**
     * @param [loadGeoJSON] Optional method for custom loading/parsing of
     * GeoJSON based on parameters passed from the main-thread Source.
     * See {@link GeoJSONWorkerSource#loadGeoJSON}.
     */
    constructor(actor: Actor, layerIndex: StyleLayerIndex, loadGeoJSON: ?LoadGeoJSON) {
        super(actor, layerIndex, loadGeoJSONTile);
        if (loadGeoJSON) {
            this.loadGeoJSON = loadGeoJSON;
        }
    }

    /**
     * Fetches (if appropriate), parses, and index geojson data into tiles. This
     * preparatory method must be called before {@link GeoJSONWorkerSource#loadTile}
     * can correctly serve up tiles.
     *
     * Defers to {@link GeoJSONWorkerSource#loadGeoJSON} for the fetching/parsing,
     * expecting `callback(error, data)` to be called with either an error or a
     * parsed GeoJSON object.
     *
     * When `loadData` requests come in faster than they can be processed,
     * they are coalesced into a single request using the latest data.
     * See {@link GeoJSONWorkerSource#coalesce}
     *
     * @param params
     * @param callback
     */
    loadData(params: LoadGeoJSONParameters, callback: Callback<{
        resourceTiming?: {[string]: Array<PerformanceResourceTiming>},
        abandoned?: boolean }>) {
        if (this._pendingCallback) {
            // Tell the foreground the previous call has been abandoned
            this._pendingCallback(null, { abandoned: true });
        }
        this._pendingCallback = callback;
        this._pendingLoadDataParams = params;

        if (this._state &&
            this._state !== 'Idle') {
            this._state = 'NeedsLoadData';
        } else {
            this._state = 'Coalescing';
            this._loadData();
        }
    }

    /**
     * Internal implementation: called directly by `loadData`
     * or by `coalesce` using stored parameters.
     */
    _loadData() {
        if (!this._pendingCallback || !this._pendingLoadDataParams) {
            assert(false);
            return;
        }
        const callback = this._pendingCallback;
        const params = this._pendingLoadDataParams;
        delete this._pendingCallback;
        delete this._pendingLoadDataParams;

        const perf = (params && params.request && params.request.collectResourceTiming) ?
            new performance.Performance(params.request) : false;

        this.loadGeoJSON(params, (err: ?Error, data: ?Object) => {
            if (err || !data) {
                return callback(err);
            } else if (typeof data !== 'object') {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            } else {
                rewind(data, true);

                try {
                    this._geoJSONIndex = params.cluster ?
                        new Supercluster(params.superclusterOptions).load(data.features) :
                        geojsonvt(data, params.geojsonVtOptions);
                } catch (err) {
                    return callback(err);
                }

                this.loaded = {};

                const result = {};
                if (perf) {
                    const resourceTimingData = perf.finish();
                    // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                    // late evaluation in the main thread causes TypeError: illegal invocation
                    if (resourceTimingData) {
                        result.resourceTiming = {};
                        result.resourceTiming[params.source] = JSON.parse(JSON.stringify(resourceTimingData));
                    }
                }
                callback(null, result);
            }
        });
    }

    /**
     * While processing `loadData`, we coalesce all further
     * `loadData` messages into a single call to _loadData
     * that will happen once we've finished processing the
     * first message. {@link GeoJSONSource#_updateWorkerData}
     * is responsible for sending us the `coalesce` message
     * at the time it receives a response from `loadData`
     *
     *          State: Idle
     *          ↑          |
     *     'coalesce'   'loadData'
     *          |     (triggers load)
     *          |          ↓
     *        State: Coalescing
     *          ↑          |
     *   (triggers load)   |
     *     'coalesce'   'loadData'
     *          |          ↓
     *        State: NeedsLoadData
     */
    coalesce() {
        if (this._state === 'Coalescing') {
            this._state = 'Idle';
        } else if (this._state === 'NeedsLoadData') {
            this._state = 'Coalescing';
            this._loadData();
        }
    }

    /**
    * Implements {@link WorkerSource#reloadTile}.
    *
    * If the tile is loaded, uses the implementation in VectorTileWorkerSource.
    * Otherwise, such as after a setData() call, we load the tile fresh.
    *
    * @param params
    * @param params.uid The UID for this tile.
    */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded,
            uid = params.uid;

        if (loaded && loaded[uid]) {
            return super.reloadTile(params, callback);
        } else {
            return this.loadTile(params, callback);
        }
    }

    /**
     * Fetch and parse GeoJSON according to the given params.  Calls `callback`
     * with `(err, data)`, where `data` is a parsed GeoJSON object.
     *
     * GeoJSON is loaded and parsed from `params.url` if it exists, or else
     * expected as a literal (string or object) `params.data`.
     *
     * @param params
     * @param [params.url] A URL to the remote GeoJSON data.
     * @param [params.data] Literal GeoJSON data. Must be provided if `params.url` is not.
     */
    loadGeoJSON(params: LoadGeoJSONParameters, callback: ResponseCallback<Object>) {
        // Because of same origin issues, urls must either include an explicit
        // origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.request) {
            getJSON(params.request, callback);
        } else if (typeof params.data === 'string') {
            try {
                return callback(null, JSON.parse(params.data));
            } catch (e) {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            }
        } else {
            return callback(new Error("Input data is not a valid GeoJSON object."));
        }
    }

    removeSource(params: {source: string}, callback: Callback<mixed>) {
        if (this._pendingCallback) {
            // Don't leak callbacks
            this._pendingCallback(null, { abandoned: true });
        }
        callback();
    }

    getClusterExpansionZoom(params: {clusterId: number}, callback: Callback<number>) {
        callback(null, this._geoJSONIndex.getClusterExpansionZoom(params.clusterId));
    }

    getClusterChildren(params: {clusterId: number}, callback: Callback<Array<GeoJSONFeature>>) {
        callback(null, this._geoJSONIndex.getChildren(params.clusterId));
    }

    getClusterLeaves(params: {clusterId: number, limit: number, offset: number}, callback: Callback<Array<GeoJSONFeature>>) {
        callback(null, this._geoJSONIndex.getLeaves(params.clusterId, params.limit, params.offset));
    }
}

export default GeoJSONWorkerSource;
