// @flow

import { bindAll } from '../util/util';

import type Dispatcher from '../util/dispatcher';
import type {Event, Evented} from '../util/evented';
import type Map from '../ui/map';
import type Tile from './tile';
import type {OverscaledTileID} from './tile_id';
import type {Callback} from '../types/callback';
import {CanonicalTileID} from './tile_id';

/**
 * The `Source` interface must be implemented by each source type, including "core" types (`vector`, `raster`,
 * `video`, etc.) and all custom, third-party types.
 *
 * @private
 *
 * @param {string} id The id for the source. Must not be used by any existing source.
 * @param {Object} options Source options, specific to the source type (except for `options.type`, which is always
 * required).
 * @param {string} options.type The source type, matching the value of `name` used in {@link Style#addSourceType}.
 * @param {Dispatcher} dispatcher A {@link Dispatcher} instance, which can be used to send messages to the workers.
 *
 * @fires data with `{dataType: 'source', sourceDataType: 'metadata'}` to indicate that any necessary metadata
 * has been loaded so that it's okay to call `loadTile`; and with `{dataType: 'source', sourceDataType: 'content'}`
 * to indicate that the source data has changed, so that any current caches should be flushed.
 * @property {string} id The id for the source.  Must match the id passed to the constructor.
 * @property {number} minzoom
 * @property {number} maxzoom
 * @property {boolean} isTileClipped `false` if tiles can be drawn outside their boundaries, `true` if they cannot.
 * @property {boolean} reparseOverscaled `true` if tiles should be sent back to the worker for each overzoomed zoom
 * level, `false` if not.
 * @property {boolean} roundZoom `true` if zoom levels are rounded to the nearest integer in the source data, `false`
 * if they are floor-ed to the nearest integer.
 */
export interface Source {
    +type: string;
    id: string;
    minzoom: number,
    maxzoom: number,
    tileSize: number,
    attribution?: string,

    roundZoom?: boolean,
    isTileClipped?: boolean,
    mapbox_logo?: boolean,
    tileID?: CanonicalTileID;
    reparseOverscaled?: boolean,
    vectorLayerIds?: Array<string>,

    hasTransition(): boolean;

    fire(event: Event): mixed;

    +onAdd?: (map: Map) => void;
    +onRemove?: (map: Map) => void;

    loadTile(tile: Tile, callback: Callback<void>): void;
    +hasTile?: (tileID: OverscaledTileID) => boolean;
    +abortTile?: (tile: Tile, callback: Callback<void>) => void;
    +unloadTile?: (tile: Tile, callback: Callback<void>) => void;

    /**
     * @returns A plain (stringifiable) JS object representing the current state of the source.
     * Creating a source using the returned object as the `options` should result in a Source that is
     * equivalent to this one.
     * @private
     */
    serialize(): Object;

    +prepare?: () => void;
}

type SourceStatics = {
    /**
     * An optional URL to a script which, when run by a Worker, registers a {@link WorkerSource}
     * implementation for this Source type by calling `self.registerWorkerSource(workerSource: WorkerSource)`.
     * @private
     */
    workerSourceURL?: URL;
};

export type SourceClass = Class<Source> & SourceStatics;

import vector from '../source/vector_tile_source';
import raster from '../source/raster_tile_source';
import rasterDem from '../source/raster_dem_tile_source';
import geojson from '../source/geojson_source';
import video from '../source/video_source';
import image from '../source/image_source';
import canvas from '../source/canvas_source';

import type {SourceSpecification} from '../style-spec/types';

const sourceTypes = {
    vector,
    raster,
    'raster-dem': rasterDem,
    geojson,
    video,
    image,
    canvas
};

/*
 * Creates a tiled data source instance given an options object.
 *
 * @param id
 * @param {Object} source A source definition object compliant with
 * [`mapbox-gl-style-spec`](https://www.mapbox.com/mapbox-gl-style-spec/#sources) or, for a third-party source type,
  * with that type's requirements.
 * @param {Dispatcher} dispatcher
 * @returns {Source}
 */
export const create = function(id: string, specification: SourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
    const source = new sourceTypes[specification.type](id, (specification: any), dispatcher, eventedParent);

    if (source.id !== id) {
        throw new Error(`Expected Source id to be ${id} instead of ${source.id}`);
    }

    bindAll(['load', 'abort', 'unload', 'serialize', 'prepare'], source);
    return source;
};

export const getType = function (name: string) {
    return sourceTypes[name];
};

export const setType = function (name: string, type: Class<Source>) {
    sourceTypes[name] = type;
};

export interface Actor {
    send(type: string, data: Object, callback: Callback<any>): void;
}
