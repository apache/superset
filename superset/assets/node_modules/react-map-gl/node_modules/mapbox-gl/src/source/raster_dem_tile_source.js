// @flow

import { getImage, ResourceType } from '../util/ajax';
import { extend } from '../util/util';
import { Evented } from '../util/evented';
import { normalizeTileURL as normalizeURL } from '../util/mapbox';
import browser from '../util/browser';
import { OverscaledTileID } from './tile_id';
import RasterTileSource from './raster_tile_source';
// ensure DEMData is registered for worker transfer on main thread:
import '../data/dem_data';

import type {Source} from './source';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type {Callback} from '../types/callback';
import type {RasterDEMSourceSpecification} from '../style-spec/types';


class RasterDEMTileSource extends RasterTileSource implements Source {
    encoding: "mapbox" | "terrarium";

    constructor(id: string, options: RasterDEMSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'raster-dem';
        this.maxzoom = 22;
        this._options = extend({}, options);
        this.encoding = options.encoding || "mapbox";
    }

    serialize() {
        return {
            type: 'raster-dem',
            url: this.url,
            tileSize: this.tileSize,
            tiles: this.tiles,
            bounds: this.bounds,
            encoding: this.encoding
        };
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const url = normalizeURL(tile.tileID.canonical.url(this.tiles, this.scheme), this.url, this.tileSize);
        tile.request = getImage(this.map._transformRequest(url, ResourceType.Tile), imageLoaded.bind(this));

        tile.neighboringTiles = this._getNeighboringTiles(tile.tileID);
        function imageLoaded(err, img) {
            delete tile.request;
            if (tile.aborted) {
                tile.state = 'unloaded';
                callback(null);
            } else if (err) {
                tile.state = 'errored';
                callback(err);
            } else if (img) {
                if (this.map._refreshExpiredTiles) tile.setExpiryData(img);
                delete (img: any).cacheControl;
                delete (img: any).expires;

                const rawImageData = browser.getImageData(img);
                const params = {
                    uid: tile.uid,
                    coord: tile.tileID,
                    source: this.id,
                    rawImageData,
                    encoding: this.encoding
                };

                if (!tile.workerID || tile.state === 'expired') {
                    tile.workerID = this.dispatcher.send('loadDEMTile', params, done.bind(this));
                }
            }
        }

        function done(err, dem) {
            if (err) {
                tile.state = 'errored';
                callback(err);
            }

            if (dem) {
                tile.dem = dem;
                tile.needsHillshadePrepare = true;
                tile.state = 'loaded';
                callback(null);
            }
        }
    }


    _getNeighboringTiles(tileID: OverscaledTileID) {
        const canonical = tileID.canonical;
        const dim = Math.pow(2, canonical.z);

        const px = (canonical.x - 1 + dim) % dim;
        const pxw = canonical.x === 0 ? tileID.wrap - 1 : tileID.wrap;
        const nx = (canonical.x + 1 + dim) % dim;
        const nxw = canonical.x + 1 === dim ? tileID.wrap + 1 : tileID.wrap;

        const neighboringTiles = {};
        // add adjacent tiles
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y).key] = {backfilled: false};
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y).key] = {backfilled: false};

        // Add upper neighboringTiles
        if (canonical.y > 0) {
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y - 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y - 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y - 1).key] = {backfilled: false};
        }
        // Add lower neighboringTiles
        if (canonical.y + 1 < dim) {
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y + 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y + 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y + 1).key] = {backfilled: false};
        }

        return neighboringTiles;
    }


    unloadTile(tile: Tile) {
        if (tile.demTexture) this.map.painter.saveTileTexture(tile.demTexture);
        if (tile.fbo) {
            tile.fbo.destroy();
            delete tile.fbo;
        }
        if (tile.dem) delete tile.dem;
        delete tile.neighboringTiles;

        tile.state = 'unloaded';
        this.dispatcher.send('removeDEMTile', { uid: tile.uid, source: this.id }, undefined, tile.workerID);
    }

}

export default RasterDEMTileSource;
