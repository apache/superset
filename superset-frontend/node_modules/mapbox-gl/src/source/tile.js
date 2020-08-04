// @flow

import { uniqueId, deepEqual, parseCacheControl } from '../util/util';
import { deserialize as deserializeBucket } from '../data/bucket';
import FeatureIndex from '../data/feature_index';
import GeoJSONFeature from '../util/vectortile_to_geojson';
import featureFilter from '../style-spec/feature_filter';
import SymbolBucket from '../data/bucket/symbol_bucket';
import { RasterBoundsArray, CollisionBoxArray } from '../data/array_types';
import rasterBoundsAttributes from '../data/raster_bounds_attributes';
import EXTENT from '../data/extent';
import Point from '@mapbox/point-geometry';
import Texture from '../render/texture';
import SegmentVector from '../data/segment';
import { TriangleIndexArray } from '../data/index_array_type';
import browser from '../util/browser';
import EvaluationParameters from '../style/evaluation_parameters';
import SourceFeatureState from '../source/source_state';

const CLOCK_SKEW_RETRY_TIMEOUT = 30000;

import type {Bucket} from '../data/bucket';
import type StyleLayer from '../style/style_layer';
import type {WorkerTileResult} from './worker_source';
import type DEMData from '../data/dem_data';
import type {AlphaImage} from '../util/image';
import type ImageAtlas from '../render/image_atlas';
import type Mask from '../render/tile_mask';
import type Context from '../gl/context';
import type IndexBuffer from '../gl/index_buffer';
import type VertexBuffer from '../gl/vertex_buffer';
import type {OverscaledTileID} from './tile_id';
import type Framebuffer from '../gl/framebuffer';
import type {PerformanceResourceTiming} from '../types/performance_resource_timing';
import type Transform from '../geo/transform';
import type {LayerFeatureStates} from './source_state';
import type {Cancelable} from '../types/cancelable';
import type {FilterSpecification} from '../style-spec/types';

export type TileState =
    | 'loading'   // Tile data is in the process of loading.
    | 'loaded'    // Tile data has been loaded. Tile can be rendered.
    | 'reloading' // Tile data has been loaded and is being updated. Tile can be rendered.
    | 'unloaded'  // Tile data has been deleted.
    | 'errored'   // Tile data was not loaded because of an error.
    | 'expired';  /* Tile data was previously loaded, but has expired per its
                   * HTTP headers and is in the process of refreshing. */

/**
 * A tile object is the combination of a Coordinate, which defines
 * its place, as well as a unique ID and data tracking for its content
 *
 * @private
 */
class Tile {
    tileID: OverscaledTileID;
    uid: number;
    uses: number;
    tileSize: number;
    buckets: {[string]: Bucket};
    latestFeatureIndex: ?FeatureIndex;
    latestRawTileData: ?ArrayBuffer;
    imageAtlas: ?ImageAtlas;
    imageAtlasTexture: Texture;
    glyphAtlasImage: ?AlphaImage;
    glyphAtlasTexture: Texture;
    expirationTime: any;
    expiredRequestCount: number;
    state: TileState;
    timeAdded: any;
    fadeEndTime: any;
    collisionBoxArray: ?CollisionBoxArray;
    redoWhenDone: boolean;
    showCollisionBoxes: boolean;
    placementSource: any;
    workerID: number | void;
    vtLayers: {[string]: VectorTileLayer};
    mask: Mask;

    neighboringTiles: ?Object;
    dem: ?DEMData;
    aborted: ?boolean;
    maskedBoundsBuffer: ?VertexBuffer;
    maskedIndexBuffer: ?IndexBuffer;
    segments: ?SegmentVector;
    needsHillshadePrepare: ?boolean;
    request: ?Cancelable;
    texture: any;
    fbo: ?Framebuffer;
    demTexture: ?Texture;
    refreshedUponExpiration: boolean;
    reloadCallback: any;
    resourceTiming: ?Array<PerformanceResourceTiming>;
    queryPadding: number;

    symbolFadeHoldUntil: ?number;
    hasSymbolBuckets: boolean;

    /**
     * @param {OverscaledTileID} tileID
     * @param size
     */
    constructor(tileID: OverscaledTileID, size: number) {
        this.tileID = tileID;
        this.uid = uniqueId();
        this.uses = 0;
        this.tileSize = size;
        this.buckets = {};
        this.expirationTime = null;
        this.queryPadding = 0;
        this.hasSymbolBuckets = false;

        // Counts the number of times a response was already expired when
        // received. We're using this to add a delay when making a new request
        // so we don't have to keep retrying immediately in case of a server
        // serving expired tiles.
        this.expiredRequestCount = 0;

        this.state = 'loading';
    }

    registerFadeDuration(duration: number) {
        const fadeEndTime = duration + this.timeAdded;
        if (fadeEndTime < browser.now()) return;
        if (this.fadeEndTime && fadeEndTime < this.fadeEndTime) return;

        this.fadeEndTime = fadeEndTime;
    }

    wasRequested() {
        return this.state === 'errored' || this.state === 'loaded' || this.state === 'reloading';
    }

    /**
     * Given a data object with a 'buffers' property, load it into
     * this tile's elementGroups and buffers properties and set loaded
     * to true. If the data is null, like in the case of an empty
     * GeoJSON tile, no-op but still set loaded to true.
     * @param {Object} data
     * @param painter
     * @returns {undefined}
     * @private
     */
    loadVectorData(data: WorkerTileResult, painter: any, justReloaded: ?boolean) {
        if (this.hasData()) {
            this.unloadVectorData();
        }

        this.state = 'loaded';

        // empty GeoJSON tile
        if (!data) {
            this.collisionBoxArray = new CollisionBoxArray();
            return;
        }

        if (data.featureIndex) {
            this.latestFeatureIndex = data.featureIndex;
            if (data.rawTileData) {
                // Only vector tiles have rawTileData, and they won't update it for
                // 'reloadTile'
                this.latestRawTileData = data.rawTileData;
                this.latestFeatureIndex.rawTileData = data.rawTileData;
            } else if (this.latestRawTileData) {
                // If rawTileData hasn't updated, hold onto a pointer to the last
                // one we received
                this.latestFeatureIndex.rawTileData = this.latestRawTileData;
            }
        }
        this.collisionBoxArray = data.collisionBoxArray;
        this.buckets = deserializeBucket(data.buckets, painter.style);

        this.hasSymbolBuckets = false;
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket instanceof SymbolBucket) {
                this.hasSymbolBuckets = true;
                if (justReloaded) {
                    bucket.justReloaded = true;
                } else {
                    break;
                }
            }
        }

        this.queryPadding = 0;
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            this.queryPadding = Math.max(this.queryPadding, painter.style.getLayer(id).queryRadius(bucket));
        }

        if (data.imageAtlas) {
            this.imageAtlas = data.imageAtlas;
        }
        if (data.glyphAtlasImage) {
            this.glyphAtlasImage = data.glyphAtlasImage;
        }
    }

    /**
     * Release any data or WebGL resources referenced by this tile.
     * @returns {undefined}
     * @private
     */
    unloadVectorData() {
        for (const id in this.buckets) {
            this.buckets[id].destroy();
        }
        this.buckets = {};

        if (this.imageAtlasTexture) {
            this.imageAtlasTexture.destroy();
        }

        if (this.imageAtlas) {
            this.imageAtlas = null;
        }

        if (this.glyphAtlasTexture) {
            this.glyphAtlasTexture.destroy();
        }

        this.latestFeatureIndex = null;
        this.state = 'unloaded';
    }

    unloadDEMData() {
        this.dem = null;
        this.neighboringTiles = null;
        this.state = 'unloaded';
    }

    getBucket(layer: StyleLayer) {
        return this.buckets[layer.id];
    }

    upload(context: Context) {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket.uploadPending()) {
                bucket.upload(context);
            }
        }

        const gl = context.gl;
        if (this.imageAtlas && !this.imageAtlas.uploaded) {
            this.imageAtlasTexture = new Texture(context, this.imageAtlas.image, gl.RGBA);
            this.imageAtlas.uploaded = true;
        }

        if (this.glyphAtlasImage) {
            this.glyphAtlasTexture = new Texture(context, this.glyphAtlasImage, gl.ALPHA);
            this.glyphAtlasImage = null;
        }
    }

    // Queries non-symbol features rendered for this tile.
    // Symbol features are queried globally
    queryRenderedFeatures(layers: {[string]: StyleLayer},
                          sourceFeatureState: SourceFeatureState,
                          queryGeometry: Array<Point>,
                          cameraQueryGeometry: Array<Point>,
                          scale: number,
                          params: { filter: FilterSpecification, layers: Array<string> },
                          transform: Transform,
                          maxPitchScaleFactor: number,
                          pixelPosMatrix: Float32Array): {[string]: Array<{ featureIndex: number, feature: GeoJSONFeature }>} {
        if (!this.latestFeatureIndex || !this.latestFeatureIndex.rawTileData)
            return {};

        return this.latestFeatureIndex.query({
            queryGeometry,
            cameraQueryGeometry,
            scale,
            tileSize: this.tileSize,
            pixelPosMatrix,
            transform,
            params,
            queryPadding: this.queryPadding * maxPitchScaleFactor
        }, layers, sourceFeatureState);
    }

    querySourceFeatures(result: Array<GeoJSONFeature>, params: any) {
        if (!this.latestFeatureIndex || !this.latestFeatureIndex.rawTileData) return;

        const vtLayers = this.latestFeatureIndex.loadVTLayers();

        const sourceLayer = params ? params.sourceLayer : '';
        const layer = vtLayers._geojsonTileLayer || vtLayers[sourceLayer];

        if (!layer) return;

        const filter = featureFilter(params && params.filter);
        const {z, x, y} = this.tileID.canonical;
        const coord = {z, x, y};

        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            if (filter(new EvaluationParameters(this.tileID.overscaledZ), feature)) {
                const geojsonFeature = new GeoJSONFeature(feature, z, x, y);
                (geojsonFeature: any).tile = coord;
                result.push(geojsonFeature);
            }
        }
    }

    clearMask() {
        if (this.segments) {
            this.segments.destroy();
            delete this.segments;
        }
        if (this.maskedBoundsBuffer) {
            this.maskedBoundsBuffer.destroy();
            delete this.maskedBoundsBuffer;
        }
        if (this.maskedIndexBuffer) {
            this.maskedIndexBuffer.destroy();
            delete this.maskedIndexBuffer;
        }
    }

    setMask(mask: Mask, context: Context) {

        // don't redo buffer work if the mask is the same;
        if (deepEqual(this.mask, mask)) return;

        this.mask = mask;
        this.clearMask();

        // We want to render the full tile, and keeping the segments/vertices/indices empty means
        // using the global shared buffers for covering the entire tile.
        if (deepEqual(mask, {'0': true})) return;

        const maskedBoundsArray = new RasterBoundsArray();
        const indexArray = new TriangleIndexArray();

        this.segments = new SegmentVector();
        // Create a new segment so that we will upload (empty) buffers even when there is nothing to
        // draw for this tile.
        this.segments.prepareSegment(0, maskedBoundsArray, indexArray);

        const maskArray = Object.keys(mask);
        for (let i = 0; i < maskArray.length; i++) {
            const maskCoord = mask[maskArray[i]];
            const vertexExtent = EXTENT >> maskCoord.z;
            const tlVertex = new Point(maskCoord.x * vertexExtent, maskCoord.y * vertexExtent);
            const brVertex = new Point(tlVertex.x + vertexExtent, tlVertex.y + vertexExtent);

            // not sure why flow is complaining here because it doesn't complain at L401
            const segment = (this.segments: any).prepareSegment(4, maskedBoundsArray, indexArray);

            maskedBoundsArray.emplaceBack(tlVertex.x, tlVertex.y, tlVertex.x, tlVertex.y);
            maskedBoundsArray.emplaceBack(brVertex.x, tlVertex.y, brVertex.x, tlVertex.y);
            maskedBoundsArray.emplaceBack(tlVertex.x, brVertex.y, tlVertex.x, brVertex.y);
            maskedBoundsArray.emplaceBack(brVertex.x, brVertex.y, brVertex.x, brVertex.y);

            const offset = segment.vertexLength;
            // 0, 1, 2
            // 1, 2, 3
            indexArray.emplaceBack(offset, offset + 1, offset + 2);
            indexArray.emplaceBack(offset + 1, offset + 2, offset + 3);

            segment.vertexLength += 4;
            segment.primitiveLength += 2;
        }

        this.maskedBoundsBuffer = context.createVertexBuffer(maskedBoundsArray, rasterBoundsAttributes.members);
        this.maskedIndexBuffer = context.createIndexBuffer(indexArray);
    }

    hasData() {
        return this.state === 'loaded' || this.state === 'reloading' || this.state === 'expired';
    }

    patternsLoaded() {
        return this.imageAtlas && !!Object.keys(this.imageAtlas.patternPositions).length;
    }

    setExpiryData(data: any) {
        const prior = this.expirationTime;

        if (data.cacheControl) {
            const parsedCC = parseCacheControl(data.cacheControl);
            if (parsedCC['max-age']) this.expirationTime = Date.now() + parsedCC['max-age'] * 1000;
        } else if (data.expires) {
            this.expirationTime = new Date(data.expires).getTime();
        }

        if (this.expirationTime) {
            const now = Date.now();
            let isExpired = false;

            if (this.expirationTime > now) {
                isExpired = false;
            } else if (!prior) {
                isExpired = true;
            } else if (this.expirationTime < prior) {
                // Expiring date is going backwards:
                // fall back to exponential backoff
                isExpired = true;

            } else {
                const delta = this.expirationTime - prior;

                if (!delta) {
                    // Server is serving the same expired resource over and over: fall
                    // back to exponential backoff.
                    isExpired = true;

                } else {
                    // Assume that either the client or the server clock is wrong and
                    // try to interpolate a valid expiration date (from the client POV)
                    // observing a minimum timeout.
                    this.expirationTime = now + Math.max(delta, CLOCK_SKEW_RETRY_TIMEOUT);

                }
            }

            if (isExpired) {
                this.expiredRequestCount++;
                this.state = 'expired';
            } else {
                this.expiredRequestCount = 0;
            }
        }
    }

    getExpiryTimeout() {
        if (this.expirationTime) {
            if (this.expiredRequestCount) {
                return 1000 * (1 << Math.min(this.expiredRequestCount - 1, 31));
            } else {
                // Max value for `setTimeout` implementations is a 32 bit integer; cap this accordingly
                return Math.min(this.expirationTime - new Date().getTime(), Math.pow(2, 31) - 1);
            }
        }
    }

    setFeatureState(states: LayerFeatureStates, painter: any) {
        if (!this.latestFeatureIndex ||
            !this.latestFeatureIndex.rawTileData ||
            Object.keys(states).length === 0) {
            return;
        }

        const vtLayers = this.latestFeatureIndex.loadVTLayers();

        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            // Buckets are grouped by common source-layer
            const sourceLayerId = bucket.layers[0]['sourceLayer'] || '_geojsonTileLayer';
            const sourceLayer = vtLayers[sourceLayerId];
            const sourceLayerStates = states[sourceLayerId];
            if (!sourceLayer || !sourceLayerStates || Object.keys(sourceLayerStates).length === 0) continue;

            bucket.update(sourceLayerStates, sourceLayer, this.imageAtlas && this.imageAtlas.patternPositions || {});
            if (painter && painter.style) {
                this.queryPadding = Math.max(this.queryPadding, painter.style.getLayer(id).queryRadius(bucket));
            }
        }
    }

    holdingForFade(): boolean {
        return this.symbolFadeHoldUntil !== undefined;
    }

    symbolFadeFinished(): boolean {
        return !this.symbolFadeHoldUntil || this.symbolFadeHoldUntil < browser.now();
    }

    clearFadeHold() {
        this.symbolFadeHoldUntil = undefined;
    }

    setHoldDuration(duration: number) {
        this.symbolFadeHoldUntil = browser.now() + duration;
    }
}

export default Tile;
