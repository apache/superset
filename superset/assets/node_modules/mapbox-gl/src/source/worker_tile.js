// @flow

import FeatureIndex from '../data/feature_index';

import { performSymbolLayout } from '../symbol/symbol_layout';
import { CollisionBoxArray } from '../data/array_types';
import DictionaryCoder from '../util/dictionary_coder';
import SymbolBucket from '../data/bucket/symbol_bucket';
import LineBucket from '../data/bucket/line_bucket';
import FillBucket from '../data/bucket/fill_bucket';
import FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket';
import { warnOnce, mapObject, values } from '../util/util';
import assert from 'assert';
import ImageAtlas from '../render/image_atlas';
import GlyphAtlas from '../render/glyph_atlas';
import EvaluationParameters from '../style/evaluation_parameters';
import { OverscaledTileID } from './tile_id';

import type {Bucket} from '../data/bucket';
import type Actor from '../util/actor';
import type StyleLayer from '../style/style_layer';
import type StyleLayerIndex from '../style/style_layer_index';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type {
    WorkerTileParameters,
    WorkerTileCallback,
} from '../source/worker_source';

class WorkerTile {
    tileID: OverscaledTileID;
    uid: string;
    zoom: number;
    pixelRatio: number;
    tileSize: number;
    source: string;
    overscaling: number;
    showCollisionBoxes: boolean;
    collectResourceTiming: boolean;
    returnDependencies: boolean;

    status: 'parsing' | 'done';
    data: VectorTile;
    collisionBoxArray: CollisionBoxArray;

    abort: ?() => void;
    reloadCallback: WorkerTileCallback;
    vectorTile: VectorTile;

    constructor(params: WorkerTileParameters) {
        this.tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        this.uid = params.uid;
        this.zoom = params.zoom;
        this.pixelRatio = params.pixelRatio;
        this.tileSize = params.tileSize;
        this.source = params.source;
        this.overscaling = this.tileID.overscaleFactor();
        this.showCollisionBoxes = params.showCollisionBoxes;
        this.collectResourceTiming = !!params.collectResourceTiming;
        this.returnDependencies = !!params.returnDependencies;
    }

    parse(data: VectorTile, layerIndex: StyleLayerIndex, actor: Actor, callback: WorkerTileCallback) {
        this.status = 'parsing';
        this.data = data;

        this.collisionBoxArray = new CollisionBoxArray();
        const sourceLayerCoder = new DictionaryCoder(Object.keys(data.layers).sort());

        const featureIndex = new FeatureIndex(this.tileID);
        featureIndex.bucketLayerIDs = [];

        const buckets: {[string]: Bucket} = {};

        const options = {
            featureIndex,
            iconDependencies: {},
            patternDependencies: {},
            glyphDependencies: {}
        };

        const layerFamilies = layerIndex.familiesBySource[this.source];
        for (const sourceLayerId in layerFamilies) {
            const sourceLayer = data.layers[sourceLayerId];
            if (!sourceLayer) {
                continue;
            }

            if (sourceLayer.version === 1) {
                warnOnce(`Vector tile source "${this.source}" layer "${sourceLayerId}" ` +
                    `does not use vector tile spec v2 and therefore may have some rendering errors.`);
            }

            const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
            const features = [];
            for (let index = 0; index < sourceLayer.length; index++) {
                const feature = sourceLayer.feature(index);
                features.push({ feature, index, sourceLayerIndex });
            }

            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];

                assert(layer.source === this.source);
                if (layer.minzoom && this.zoom < Math.floor(layer.minzoom)) continue;
                if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
                if (layer.visibility === 'none') continue;

                recalculateLayers(family, this.zoom);

                const bucket = buckets[layer.id] = layer.createBucket({
                    index: featureIndex.bucketLayerIDs.length,
                    layers: family,
                    zoom: this.zoom,
                    pixelRatio: this.pixelRatio,
                    overscaling: this.overscaling,
                    collisionBoxArray: this.collisionBoxArray,
                    sourceLayerIndex,
                    sourceID: this.source
                });

                bucket.populate(features, options);
                featureIndex.bucketLayerIDs.push(family.map((l) => l.id));
            }
        }

        let error: ?Error;
        let glyphMap: ?{[string]: {[number]: ?StyleGlyph}};
        let iconMap: ?{[string]: StyleImage};
        let patternMap: ?{[string]: StyleImage};

        const stacks = mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));
        if (Object.keys(stacks).length) {
            actor.send('getGlyphs', {uid: this.uid, stacks}, (err, result) => {
                if (!error) {
                    error = err;
                    glyphMap = result;
                    maybePrepare.call(this);
                }
            });
        } else {
            glyphMap = {};
        }

        const icons = Object.keys(options.iconDependencies);
        if (icons.length) {
            actor.send('getImages', {icons}, (err, result) => {
                if (!error) {
                    error = err;
                    iconMap = result;
                    maybePrepare.call(this);
                }
            });
        } else {
            iconMap = {};
        }

        const patterns = Object.keys(options.patternDependencies);
        if (patterns.length) {
            actor.send('getImages', {icons: patterns}, (err, result) => {
                if (!error) {
                    error = err;
                    patternMap = result;
                    maybePrepare.call(this);
                }
            });
        } else {
            patternMap = {};
        }


        maybePrepare.call(this);

        function maybePrepare() {
            if (error) {
                return callback(error);
            } else if (glyphMap && iconMap && patternMap) {
                const glyphAtlas = new GlyphAtlas(glyphMap);
                const imageAtlas = new ImageAtlas(iconMap, patternMap);

                for (const key in buckets) {
                    const bucket = buckets[key];
                    if (bucket instanceof SymbolBucket) {
                        recalculateLayers(bucket.layers, this.zoom);
                        performSymbolLayout(bucket, glyphMap, glyphAtlas.positions, iconMap, imageAtlas.iconPositions, this.showCollisionBoxes);
                    } else if (bucket.hasPattern &&
                        (bucket instanceof LineBucket ||
                         bucket instanceof FillBucket ||
                         bucket instanceof FillExtrusionBucket)) {
                        recalculateLayers(bucket.layers, this.zoom);
                        bucket.addFeatures(options, imageAtlas.patternPositions);
                    }
                }

                this.status = 'done';
                callback(null, {
                    buckets: values(buckets).filter(b => !b.isEmpty()),
                    featureIndex,
                    collisionBoxArray: this.collisionBoxArray,
                    glyphAtlasImage: glyphAtlas.image,
                    imageAtlas,
                    // Only used for benchmarking:
                    glyphMap: this.returnDependencies ? glyphMap : null,
                    iconMap: this.returnDependencies ? iconMap : null,
                    glyphPositions: this.returnDependencies ? glyphAtlas.positions : null
                });
            }
        }
    }
}

function recalculateLayers(layers: $ReadOnlyArray<StyleLayer>, zoom: number) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    const parameters = new EvaluationParameters(zoom);
    for (const layer of layers) {
        layer.recalculate(parameters);
    }
}

export default WorkerTile;
