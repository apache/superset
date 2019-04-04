// @flow

import { create as createSource } from './source';

import Tile from './tile';
import { Event, ErrorEvent, Evented } from '../util/evented';
import TileCache from './tile_cache';
import MercatorCoordinate from '../geo/mercator_coordinate';
import { keysDifference } from '../util/util';
import EXTENT from '../data/extent';
import Context from '../gl/context';
import Point from '@mapbox/point-geometry';
import browser from '../util/browser';
import { OverscaledTileID } from './tile_id';
import assert from 'assert';
import SourceFeatureState from './source_state';

import type {Source} from './source';
import type Map from '../ui/map';
import type Style from '../style/style';
import type Dispatcher from '../util/dispatcher';
import type Transform from '../geo/transform';
import type {TileState} from './tile';
import type {Callback} from '../types/callback';
import type {SourceSpecification} from '../style-spec/types';

/**
 * `SourceCache` is responsible for
 *
 *  - creating an instance of `Source`
 *  - forwarding events from `Source`
 *  - caching tiles loaded from an instance of `Source`
 *  - loading the tiles needed to render a given viewport
 *  - unloading the cached tiles not needed to render a given viewport
 *
 * @private
 */
class SourceCache extends Evented {
    id: string;
    dispatcher: Dispatcher;
    map: Map;
    style: Style;

    _source: Source;
    _sourceLoaded: boolean;
    _sourceErrored: boolean;
    _tiles: {[any]: Tile};
    _prevLng: number | void;
    _cache: TileCache;
    _timers: {[any]: TimeoutID};
    _cacheTimers: {[any]: TimeoutID};
    _maxTileCacheSize: ?number;
    _paused: boolean;
    _shouldReloadOnResume: boolean;
    _coveredTiles: {[any]: boolean};
    transform: Transform;
    _isIdRenderable: (id: number, symbolLayer?: boolean) => boolean;
    used: boolean;
    _state: SourceFeatureState;

    static maxUnderzooming: number;
    static maxOverzooming: number;

    constructor(id: string, options: SourceSpecification, dispatcher: Dispatcher) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;

        this.on('data', (e) => {
            // this._sourceLoaded signifies that the TileJSON is loaded if applicable.
            // if the source type does not come with a TileJSON, the flag signifies the
            // source data has loaded (i.e geojson has been tiled on the worker and is ready)
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') this._sourceLoaded = true;

            // for sources with mutable data, this event fires when the underlying data
            // to a source is changed. (i.e. GeoJSONSource#setData and ImageSource#serCoordinates)
            if (this._sourceLoaded && !this._paused && e.dataType === "source" && e.sourceDataType === 'content') {
                this.reload();
                if (this.transform) {
                    this.update(this.transform);
                }
            }
        });

        this.on('error', () => {
            this._sourceErrored = true;
        });

        this._source = createSource(id, options, dispatcher, this);

        this._tiles = {};
        this._cache = new TileCache(0, this._unloadTile.bind(this));
        this._timers = {};
        this._cacheTimers = {};
        this._maxTileCacheSize = null;

        this._coveredTiles = {};
        this._state = new SourceFeatureState();
    }

    onAdd(map: Map) {
        this.map = map;
        this._maxTileCacheSize = map ? map._maxTileCacheSize : null;
        if (this._source && this._source.onAdd) {
            this._source.onAdd(map);
        }
    }

    onRemove(map: Map) {
        if (this._source && this._source.onRemove) {
            this._source.onRemove(map);
        }
    }

    /**
     * Return true if no tile data is pending, tiles will not change unless
     * an additional API call is received.
     */
    loaded(): boolean {
        if (this._sourceErrored) { return true; }
        if (!this._sourceLoaded) { return false; }
        for (const t in this._tiles) {
            const tile = this._tiles[t];
            if (tile.state !== 'loaded' && tile.state !== 'errored')
                return false;
        }
        return true;
    }

    getSource(): Source {
        return this._source;
    }

    pause() {
        this._paused = true;
    }

    resume() {
        if (!this._paused) return;
        const shouldReload = this._shouldReloadOnResume;
        this._paused = false;
        this._shouldReloadOnResume = false;
        if (shouldReload) this.reload();
        if (this.transform) this.update(this.transform);
    }

    _loadTile(tile: Tile, callback: Callback<void>) {
        return this._source.loadTile(tile, callback);
    }

    _unloadTile(tile: Tile) {
        if (this._source.unloadTile)
            return this._source.unloadTile(tile, () => {});
    }

    _abortTile(tile: Tile) {
        if (this._source.abortTile)
            return this._source.abortTile(tile, () => {});
    }

    serialize() {
        return this._source.serialize();
    }

    prepare(context: Context) {
        if  (this._source.prepare) {
            this._source.prepare();
        }

        this._state.coalesceChanges(this._tiles, this.map ? this.map.painter : null);
        for (const i in this._tiles) {
            this._tiles[i].upload(context);
        }
    }

    /**
     * Return all tile ids ordered with z-order, and cast to numbers
     */
    getIds(): Array<number> {
        return Object.keys(this._tiles).map(Number).sort(compareKeyZoom);
    }

    getRenderableIds(symbolLayer?: boolean): Array<number> {
        const ids = [];
        for (const id in this._tiles) {
            if (this._isIdRenderable(+id, symbolLayer)) ids.push(+id);
        }
        if (symbolLayer) {
            return ids.sort((a_, b_) => {
                const a = this._tiles[a_].tileID;
                const b = this._tiles[b_].tileID;
                const rotatedA = (new Point(a.canonical.x, a.canonical.y))._rotate(this.transform.angle);
                const rotatedB = (new Point(b.canonical.x, b.canonical.y))._rotate(this.transform.angle);
                return a.overscaledZ - b.overscaledZ || rotatedB.y - rotatedA.y || rotatedB.x - rotatedA.x;
            });
        }
        return ids.sort(compareKeyZoom);
    }

    hasRenderableParent(tileID: OverscaledTileID) {
        const parentTile = this.findLoadedParent(tileID, 0);
        if (parentTile) {
            return this._isIdRenderable(parentTile.tileID.key);
        }
        return false;
    }

    _isIdRenderable(id: number, symbolLayer?: boolean) {
        return this._tiles[id] && this._tiles[id].hasData() &&
            !this._coveredTiles[id] && (symbolLayer || !this._tiles[id].holdingForFade());
    }

    reload() {
        if (this._paused) {
            this._shouldReloadOnResume = true;
            return;
        }

        this._cache.reset();

        for (const i in this._tiles) {
            if (this._tiles[i].state !== "errored") this._reloadTile(i, 'reloading');
        }
    }

    _reloadTile(id: string | number, state: TileState) {
        const tile = this._tiles[id];

        // this potentially does not address all underlying
        // issues https://github.com/mapbox/mapbox-gl-js/issues/4252
        // - hard to tell without repro steps
        if (!tile) return;

        // The difference between "loading" tiles and "reloading" or "expired"
        // tiles is that "reloading"/"expired" tiles are "renderable".
        // Therefore, a "loading" tile cannot become a "reloading" tile without
        // first becoming a "loaded" tile.
        if (tile.state !== 'loading') {
            tile.state = state;
        }

        this._loadTile(tile, this._tileLoaded.bind(this, tile, id, state));
    }

    _tileLoaded(tile: Tile, id: string | number, previousState: TileState, err: ?Error) {
        if (err) {
            tile.state = 'errored';
            if ((err: any).status !== 404) this._source.fire(new ErrorEvent(err, {tile}));
            // continue to try loading parent/children tiles if a tile doesn't exist (404)
            else this.update(this.transform);
            return;
        }

        tile.timeAdded = browser.now();
        if (previousState === 'expired') tile.refreshedUponExpiration = true;
        this._setTileReloadTimer(id, tile);
        if (this.getSource().type === 'raster-dem' && tile.dem) this._backfillDEM(tile);
        this._state.initializeTileState(tile, this.map ? this.map.painter : null);

        this._source.fire(new Event('data', {dataType: 'source', tile, coord: tile.tileID}));
    }

    /**
    * For raster terrain source, backfill DEM to eliminate visible tile boundaries
    * @private
    */
    _backfillDEM(tile: Tile) {
        const renderables = this.getRenderableIds();
        for (let i = 0; i < renderables.length; i++) {
            const borderId = renderables[i];
            if (tile.neighboringTiles && tile.neighboringTiles[borderId]) {
                const borderTile = this.getTileByID(borderId);
                fillBorder(tile, borderTile);
                fillBorder(borderTile, tile);
            }
        }

        function fillBorder(tile, borderTile) {
            tile.needsHillshadePrepare = true;
            let dx = borderTile.tileID.canonical.x - tile.tileID.canonical.x;
            const dy = borderTile.tileID.canonical.y - tile.tileID.canonical.y;
            const dim = Math.pow(2, tile.tileID.canonical.z);
            const borderId = borderTile.tileID.key;
            if (dx === 0 && dy === 0) return;

            if (Math.abs(dy) > 1) {
                return;
            }
            if (Math.abs(dx) > 1) {
                // Adjust the delta coordinate for world wraparound.
                if (Math.abs(dx + dim) === 1) {
                    dx += dim;
                } else if (Math.abs(dx - dim) === 1) {
                    dx -= dim;
                }
            }
            if (!borderTile.dem || !tile.dem) return;
            tile.dem.backfillBorder(borderTile.dem, dx, dy);
            if (tile.neighboringTiles && tile.neighboringTiles[borderId])
                tile.neighboringTiles[borderId].backfilled = true;
        }
    }
    /**
     * Get a specific tile by TileID
     */
    getTile(tileID: OverscaledTileID): Tile {
        return this.getTileByID(tileID.key);
    }

    /**
     * Get a specific tile by id
     */
    getTileByID(id: string | number): Tile {
        return this._tiles[id];
    }

    /**
     * get the zoom level adjusted for the difference in map and source tilesizes
     */
    getZoom(transform: Transform): number {
        return transform.zoom + transform.scaleZoom(transform.tileSize / this._source.tileSize);
    }

    /**
     * For a given set of tiles, retain children that are loaded and have a zoom
     * between `zoom` (exclusive) and `maxCoveringZoom` (inclusive)
     */
    _retainLoadedChildren(
        idealTiles: {[any]: OverscaledTileID},
        zoom: number,
        maxCoveringZoom: number,
        retain: {[any]: OverscaledTileID}
    ) {
        for (const id in this._tiles) {
            let tile = this._tiles[id];

            // only consider renderable tiles up to maxCoveringZoom
            if (retain[id] ||
                !tile.hasData() ||
                tile.tileID.overscaledZ <= zoom ||
                tile.tileID.overscaledZ > maxCoveringZoom
            ) continue;

            // loop through parents and retain the topmost loaded one if found
            let topmostLoadedID = tile.tileID;
            while (tile && tile.tileID.overscaledZ > zoom + 1) {
                const parentID = tile.tileID.scaledTo(tile.tileID.overscaledZ - 1);

                tile = this._tiles[parentID.key];

                if (tile && tile.hasData()) {
                    topmostLoadedID = parentID;
                }
            }

            // loop through ancestors of the topmost loaded child to see if there's one that needed it
            let tileID = topmostLoadedID;
            while (tileID.overscaledZ > zoom) {
                tileID = tileID.scaledTo(tileID.overscaledZ - 1);

                if (idealTiles[tileID.key]) {
                    // found a parent that needed a loaded child; retain that child
                    retain[topmostLoadedID.key] = topmostLoadedID;
                    break;
                }
            }
        }
    }

    /**
     * Find a loaded parent of the given tile (up to minCoveringZoom)
     */
    findLoadedParent(tileID: OverscaledTileID, minCoveringZoom: number): ?Tile {
        for (let z = tileID.overscaledZ - 1; z >= minCoveringZoom; z--) {
            const parent = tileID.scaledTo(z);
            if (!parent) return;
            const id = String(parent.key);
            const tile = this._tiles[id];
            if (tile && tile.hasData()) {
                return tile;
            }
            if (this._cache.has(parent)) {
                return this._cache.get(parent);
            }
        }
    }

    /**
     * Resizes the tile cache based on the current viewport's size
     * or the maxTileCacheSize option passed during map creation
     *
     * Larger viewports use more tiles and need larger caches. Larger viewports
     * are more likely to be found on devices with more memory and on pages where
     * the map is more important.
     */
    updateCacheSize(transform: Transform) {
        const widthInTiles = Math.ceil(transform.width / this._source.tileSize) + 1;
        const heightInTiles = Math.ceil(transform.height / this._source.tileSize) + 1;
        const approxTilesInView = widthInTiles * heightInTiles;
        const commonZoomRange = 5;

        const viewDependentMaxSize = Math.floor(approxTilesInView * commonZoomRange);
        const maxSize = typeof this._maxTileCacheSize === 'number' ? Math.min(this._maxTileCacheSize, viewDependentMaxSize) : viewDependentMaxSize;

        this._cache.setMaxSize(maxSize);
    }

    handleWrapJump(lng: number) {
        // On top of the regular z/x/y values, TileIDs have a `wrap` value that specify
        // which cppy of the world the tile belongs to. For example, at `lng: 10` you
        // might render z/x/y/0 while at `lng: 370` you would render z/x/y/1.
        //
        // When lng values get wrapped (going from `lng: 370` to `long: 10`) you expect
        // to see the same thing on the screen (370 degrees and 10 degrees is the same
        // place in the world) but all the TileIDs will have different wrap values.
        //
        // In order to make this transition seamless, we calculate the rounded difference of
        // "worlds" between the last frame and the current frame. If the map panned by
        // a world, then we can assign all the tiles new TileIDs with updated wrap values.
        // For example, assign z/x/y/1 a new id: z/x/y/0. It is the same tile, just rendered
        // in a different position.
        //
        // This enables us to reuse the tiles at more ideal locations and prevent flickering.
        const prevLng = this._prevLng === undefined ? lng : this._prevLng;
        const lngDifference = lng - prevLng;
        const worldDifference = lngDifference / 360;
        const wrapDelta = Math.round(worldDifference);
        this._prevLng = lng;

        if (wrapDelta) {
            const tiles = {};
            for (const key in this._tiles) {
                const tile = this._tiles[key];
                tile.tileID = tile.tileID.unwrapTo(tile.tileID.wrap + wrapDelta);
                tiles[tile.tileID.key] = tile;
            }
            this._tiles = tiles;

            // Reset tile reload timers
            for (const id in this._timers) {
                clearTimeout(this._timers[id]);
                delete this._timers[id];
            }
            for (const id in this._tiles) {
                const tile = this._tiles[id];
                this._setTileReloadTimer(id, tile);
            }
        }
    }

    /**
     * Removes tiles that are outside the viewport and adds new tiles that
     * are inside the viewport.
     */
    update(transform: Transform) {
        this.transform = transform;
        if (!this._sourceLoaded || this._paused) { return; }

        this.updateCacheSize(transform);
        this.handleWrapJump(this.transform.center.lng);

        // Covered is a list of retained tiles who's areas are fully covered by other,
        // better, retained tiles. They are not drawn separately.
        this._coveredTiles = {};

        let idealTileIDs;
        if (!this.used) {
            idealTileIDs = [];
        } else if (this._source.tileID) {
            idealTileIDs = transform.getVisibleUnwrappedCoordinates(this._source.tileID)
                .map((unwrapped) => new OverscaledTileID(unwrapped.canonical.z, unwrapped.wrap, unwrapped.canonical.z, unwrapped.canonical.x, unwrapped.canonical.y));
        } else {
            idealTileIDs = transform.coveringTiles({
                tileSize: this._source.tileSize,
                minzoom: this._source.minzoom,
                maxzoom: this._source.maxzoom,
                roundZoom: this._source.roundZoom,
                reparseOverscaled: this._source.reparseOverscaled
            });

            if (this._source.hasTile) {
                idealTileIDs = idealTileIDs.filter((coord) => (this._source.hasTile: any)(coord));
            }
        }

        // Determine the overzooming/underzooming amounts.
        const zoom = (this._source.roundZoom ? Math.round : Math.floor)(this.getZoom(transform));
        const minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this._source.minzoom);
        const maxCoveringZoom = Math.max(zoom + SourceCache.maxUnderzooming,  this._source.minzoom);

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        const retain = this._updateRetainedTiles(idealTileIDs, zoom);

        if (isRasterType(this._source.type)) {
            const parentsForFading = {};
            const fadingTiles = {};
            const ids = Object.keys(retain);
            for (const id of ids) {
                const tileID = retain[id];
                assert(tileID.key === +id);

                const tile = this._tiles[id];
                if (!tile || tile.fadeEndTime && tile.fadeEndTime <= browser.now()) continue;

                // if the tile is loaded but still fading in, find parents to cross-fade with it
                const parentTile = this.findLoadedParent(tileID, minCoveringZoom);
                if (parentTile) {
                    this._addTile(parentTile.tileID);
                    parentsForFading[parentTile.tileID.key] = parentTile.tileID;
                }

                fadingTiles[id] = tileID;
            }

            // for tiles that are still fading in, also find children to cross-fade with
            this._retainLoadedChildren(fadingTiles, zoom, maxCoveringZoom, retain);

            for (const id in parentsForFading) {
                if (!retain[id]) {
                    // If a tile is only needed for fading, mark it as covered so that it isn't rendered on it's own.
                    this._coveredTiles[id] = true;
                    retain[id] = parentsForFading[id];
                }
            }
        }

        for (const retainedId in retain) {
            // Make sure retained tiles always clear any existing fade holds
            // so that if they're removed again their fade timer starts fresh.
            this._tiles[retainedId].clearFadeHold();
        }

        // Remove the tiles we don't need anymore.
        const remove = keysDifference(this._tiles, retain);
        for (const tileID of remove) {
            const tile = this._tiles[tileID];
            if (tile.hasSymbolBuckets && !tile.holdingForFade()) {
                tile.setHoldDuration(this.map._fadeDuration);
            } else if (!tile.hasSymbolBuckets || tile.symbolFadeFinished()) {
                this._removeTile(tileID);
            }
        }
    }

    releaseSymbolFadeTiles() {
        for (const id in this._tiles) {
            if (this._tiles[id].holdingForFade()) {
                this._removeTile(id);
            }
        }
    }

    _updateRetainedTiles(idealTileIDs: Array<OverscaledTileID>, zoom: number): { [string]: OverscaledTileID} {
        const retain = {};
        const checked: {[number]: boolean } = {};
        const minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this._source.minzoom);
        const maxCoveringZoom = Math.max(zoom + SourceCache.maxUnderzooming,  this._source.minzoom);

        const missingTiles = {};
        for (const tileID of idealTileIDs) {
            const tile = this._addTile(tileID);

            // retain the tile even if it's not loaded because it's an ideal tile.
            retain[tileID.key] = tileID;

            if (tile.hasData()) continue;

            if (zoom < this._source.maxzoom) {
                // save missing tiles that potentially have loaded children
                missingTiles[tileID.key] = tileID;
            }
        }

        // retain any loaded children of ideal tiles up to maxCoveringZoom
        this._retainLoadedChildren(missingTiles, zoom, maxCoveringZoom, retain);

        for (const tileID of idealTileIDs) {
            let tile = this._tiles[tileID.key];

            if (tile.hasData()) continue;

            // The tile we require is not yet loaded or does not exist;
            // Attempt to find children that fully cover it.

            if (zoom + 1 > this._source.maxzoom) {
                // We're looking for an overzoomed child tile.
                const childCoord = tileID.children(this._source.maxzoom)[0];
                const childTile = this.getTile(childCoord);
                if (!!childTile && childTile.hasData()) {
                    retain[childCoord.key] = childCoord;
                    continue; // tile is covered by overzoomed child
                }
            } else {
                // check if all 4 immediate children are loaded (i.e. the missing ideal tile is covered)
                const children = tileID.children(this._source.maxzoom);

                if (retain[children[0].key] &&
                    retain[children[1].key] &&
                    retain[children[2].key] &&
                    retain[children[3].key]) continue; // tile is covered by children
            }

            // We couldn't find child tiles that entirely cover the ideal tile; look for parents now.

            // As we ascend up the tile pyramid of the ideal tile, we check whether the parent
            // tile has been previously requested (and errored because we only loop over tiles with no data)
            // in order to determine if we need to request its parent.
            let parentWasRequested = tile.wasRequested();

            for (let overscaledZ = tileID.overscaledZ - 1; overscaledZ >= minCoveringZoom; --overscaledZ) {
                const parentId = tileID.scaledTo(overscaledZ);

                // Break parent tile ascent if this route has been previously checked by another child.
                if (checked[parentId.key]) break;
                checked[parentId.key] = true;

                tile = this.getTile(parentId);
                if (!tile && parentWasRequested) {
                    tile = this._addTile(parentId);
                }
                if (tile) {
                    retain[parentId.key] = parentId;
                    // Save the current values, since they're the parent of the next iteration
                    // of the parent tile ascent loop.
                    parentWasRequested = tile.wasRequested();
                    if (tile.hasData()) break;
                }
            }
        }

        return retain;
    }

    /**
     * Add a tile, given its coordinate, to the pyramid.
     * @private
     */
    _addTile(tileID: OverscaledTileID): Tile {
        let tile = this._tiles[tileID.key];
        if (tile)
            return tile;


        tile = this._cache.getAndRemove(tileID);
        if (tile) {
            this._setTileReloadTimer(tileID.key, tile);
            // set the tileID because the cached tile could have had a different wrap value
            tile.tileID = tileID;
            this._state.initializeTileState(tile, this.map ? this.map.painter : null);
            if (this._cacheTimers[tileID.key]) {
                clearTimeout(this._cacheTimers[tileID.key]);
                delete this._cacheTimers[tileID.key];
                this._setTileReloadTimer(tileID.key, tile);
            }
        }

        const cached = Boolean(tile);
        if (!cached) {
            tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor());
            this._loadTile(tile, this._tileLoaded.bind(this, tile, tileID.key, tile.state));
        }

        // Impossible, but silence flow.
        if (!tile) return (null: any);

        tile.uses++;
        this._tiles[tileID.key] = tile;
        if (!cached) this._source.fire(new Event('dataloading', {tile, coord: tile.tileID, dataType: 'source'}));

        return tile;
    }

    _setTileReloadTimer(id: string | number, tile: Tile) {
        if (id in this._timers) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }

        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._timers[id] = setTimeout(() => {
                this._reloadTile(id, 'expired');
                delete this._timers[id];
            }, expiryTimeout);
        }
    }

    /**
     * Remove a tile, given its id, from the pyramid
     * @private
     */
    _removeTile(id: string | number) {
        const tile = this._tiles[id];
        if (!tile)
            return;

        tile.uses--;
        delete this._tiles[id];
        if (this._timers[id]) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }

        if (tile.uses > 0)
            return;

        if (tile.hasData()) {
            this._cache.add(tile.tileID, tile, tile.getExpiryTimeout());
        } else {
            tile.aborted = true;
            this._abortTile(tile);
            this._unloadTile(tile);
        }
    }

    /**
     * Remove all tiles from this pyramid
     */
    clearTiles() {
        this._shouldReloadOnResume = false;
        this._paused = false;

        for (const id in this._tiles)
            this._removeTile(id);

        this._cache.reset();
    }

    /**
     * Search through our current tiles and attempt to find the tiles that
     * cover the given bounds.
     * @param pointQueryGeometry coordinates of the corners of bounding rectangle
     * @returns {Array<Object>} result items have {tile, minX, maxX, minY, maxY}, where min/max bounding values are the given bounds transformed in into the coordinate space of this tile.
     */
    tilesIn(pointQueryGeometry: Array<Point>, maxPitchScaleFactor: number, has3DLayer: boolean) {

        const tileResults = [];

        const transform = this.transform;
        if (!transform) return tileResults;

        const cameraPointQueryGeometry = has3DLayer ?
            transform.getCameraQueryGeometry(pointQueryGeometry) :
            pointQueryGeometry;

        const queryGeometry = pointQueryGeometry.map((p) => transform.pointCoordinate(p));
        const cameraQueryGeometry = cameraPointQueryGeometry.map((p) => transform.pointCoordinate(p));

        const ids = this.getIds();

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const p of cameraQueryGeometry) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        for (let i = 0; i < ids.length; i++) {
            const tile = this._tiles[ids[i]];
            if (tile.holdingForFade()) {
                // Tiles held for fading are covered by tiles that are closer to ideal
                continue;
            }
            const tileID = tile.tileID;
            const scale = Math.pow(2, transform.zoom - tile.tileID.overscaledZ);
            const queryPadding = maxPitchScaleFactor * tile.queryPadding * EXTENT / tile.tileSize / scale;

            const tileSpaceBounds = [
                tileID.getTilePoint(new MercatorCoordinate(minX, minY)),
                tileID.getTilePoint(new MercatorCoordinate(maxX, maxY))
            ];

            if (tileSpaceBounds[0].x - queryPadding < EXTENT && tileSpaceBounds[0].y - queryPadding < EXTENT &&
                tileSpaceBounds[1].x + queryPadding >= 0 && tileSpaceBounds[1].y + queryPadding >= 0) {

                const tileSpaceQueryGeometry: Array<Point> = queryGeometry.map((c) => tileID.getTilePoint(c));
                const tileSpaceCameraQueryGeometry = cameraQueryGeometry.map((c) => tileID.getTilePoint(c));

                tileResults.push({
                    tile,
                    tileID,
                    queryGeometry: tileSpaceQueryGeometry,
                    cameraQueryGeometry: tileSpaceCameraQueryGeometry,
                    scale
                });
            }
        }

        return tileResults;
    }

    getVisibleCoordinates(symbolLayer?: boolean): Array<OverscaledTileID> {
        const coords = this.getRenderableIds(symbolLayer).map((id) => this._tiles[id].tileID);
        for (const coord of coords) {
            coord.posMatrix = this.transform.calculatePosMatrix(coord.toUnwrapped());
        }
        return coords;
    }

    hasTransition() {
        if (this._source.hasTransition()) {
            return true;
        }

        if (isRasterType(this._source.type)) {
            for (const id in this._tiles) {
                const tile = this._tiles[id];
                if (tile.fadeEndTime !== undefined && tile.fadeEndTime >= browser.now()) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Set the value of a particular state for a feature
     * @private
     */
    setFeatureState(sourceLayer?: string, feature: number, state: Object) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        this._state.updateState(sourceLayer, feature, state);
    }

    /**
     * Resets the value of a particular state key for a feature
     * @private
     */
    removeFeatureState(sourceLayer?: string, feature?: number, key?: string) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        this._state.removeFeatureState(sourceLayer, feature, key);
    }

    /**
     * Get the entire state object for a feature
     * @private
     */
    getFeatureState(sourceLayer?: string, feature: number) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        return this._state.getState(sourceLayer, feature);
    }
}

SourceCache.maxOverzooming = 10;
SourceCache.maxUnderzooming = 3;

function compareKeyZoom(a, b) {
    return ((a % 32) - (b % 32)) || (b - a);
}

function isRasterType(type) {
    return type === 'raster' || type === 'image' || type === 'video';
}

export default SourceCache;
