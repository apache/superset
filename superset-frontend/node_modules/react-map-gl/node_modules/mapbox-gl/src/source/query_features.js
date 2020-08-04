// @flow

import type SourceCache from './source_cache';
import type StyleLayer from '../style/style_layer';
import type CollisionIndex from '../symbol/collision_index';
import type Transform from '../geo/transform';
import type { RetainedQueryData } from '../symbol/placement';
import type {FilterSpecification} from '../style-spec/types';
import assert from 'assert';
import { mat4 } from 'gl-matrix';

/*
 * Returns a matrix that can be used to convert from tile coordinates to viewport pixel coordinates.
 */
function getPixelPosMatrix(transform, tileID) {
    const t = mat4.identity([]);
    mat4.translate(t, t, [1, 1, 0]);
    mat4.scale(t, t, [transform.width * 0.5, transform.height * 0.5, 1]);
    return mat4.multiply(t, t, transform.calculatePosMatrix(tileID.toUnwrapped()));
}

function queryIncludes3DLayer(layers?: Array<string>, styleLayers: {[string]: StyleLayer}, sourceID: string) {
    if (layers) {
        for (const layerID of layers) {
            const layer = styleLayers[layerID];
            if (layer && layer.source === sourceID && layer.type === 'fill-extrusion') {
                return true;
            }
        }
    } else {
        for (const key in styleLayers) {
            const layer = styleLayers[key];
            if (layer.source === sourceID && layer.type === 'fill-extrusion') {
                return true;
            }
        }
    }
    return false;
}

export function queryRenderedFeatures(sourceCache: SourceCache,
                            styleLayers: {[string]: StyleLayer},
                            queryGeometry: Array<Point>,
                            params: { filter: FilterSpecification, layers: Array<string> },
                            transform: Transform) {

    const has3DLayer = queryIncludes3DLayer(params && params.layers, styleLayers, sourceCache.id);

    const maxPitchScaleFactor = transform.maxPitchScaleFactor();
    const tilesIn = sourceCache.tilesIn(queryGeometry, maxPitchScaleFactor, has3DLayer);

    tilesIn.sort(sortTilesIn);

    const renderedFeatureLayers = [];
    for (const tileIn of tilesIn) {
        renderedFeatureLayers.push({
            wrappedTileID: tileIn.tileID.wrapped().key,
            queryResults: tileIn.tile.queryRenderedFeatures(
                styleLayers,
                sourceCache._state,
                tileIn.queryGeometry,
                tileIn.cameraQueryGeometry,
                tileIn.scale,
                params,
                transform,
                maxPitchScaleFactor,
                getPixelPosMatrix(sourceCache.transform, tileIn.tileID))
        });
    }

    const result = mergeRenderedFeatureLayers(renderedFeatureLayers);

    // Merge state from SourceCache into the results
    for (const layerID in result) {
        result[layerID].forEach((featureWrapper) => {
            const feature = featureWrapper.feature;
            const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
            feature.source = feature.layer.source;
            if (feature.layer['source-layer']) {
                feature.sourceLayer = feature.layer['source-layer'];
            }
            feature.state = state;
        });
    }
    return result;
}

export function queryRenderedSymbols(styleLayers: {[string]: StyleLayer},
                            sourceCaches: {[string]: SourceCache},
                            queryGeometry: Array<Point>,
                            params: { filter: FilterSpecification, layers: Array<string> },
                            collisionIndex: CollisionIndex,
                            retainedQueryData: {[number]: RetainedQueryData}) {
    const result = {};
    const renderedSymbols = collisionIndex.queryRenderedSymbols(queryGeometry);
    const bucketQueryData = [];
    for (const bucketInstanceId of Object.keys(renderedSymbols).map(Number)) {
        bucketQueryData.push(retainedQueryData[bucketInstanceId]);
    }
    bucketQueryData.sort(sortTilesIn);

    for (const queryData of bucketQueryData) {
        const bucketSymbols = queryData.featureIndex.lookupSymbolFeatures(
                renderedSymbols[queryData.bucketInstanceId],
                queryData.bucketIndex,
                queryData.sourceLayerIndex,
                params.filter,
                params.layers,
                styleLayers);

        for (const layerID in bucketSymbols) {
            const resultFeatures = result[layerID] = result[layerID] || [];
            const layerSymbols = bucketSymbols[layerID];
            layerSymbols.sort((a, b) => {
                // Match topDownFeatureComparator from FeatureIndex, but using
                // most recent sorting of features from bucket.sortFeatures
                const featureSortOrder = queryData.featureSortOrder;
                if (featureSortOrder) {
                    // queryRenderedSymbols documentation says we'll return features in
                    // "top-to-bottom" rendering order (aka last-to-first).
                    // Actually there can be multiple symbol instances per feature, so
                    // we sort each feature based on the first matching symbol instance.
                    const sortedA = featureSortOrder.indexOf(a.featureIndex);
                    const sortedB = featureSortOrder.indexOf(b.featureIndex);
                    assert(sortedA >= 0);
                    assert(sortedB >= 0);
                    return sortedB - sortedA;
                } else {
                    // Bucket hasn't been re-sorted based on angle, so use the
                    // reverse of the order the features appeared in the data.
                    return b.featureIndex - a.featureIndex;
                }
            });
            for (const symbolFeature of layerSymbols) {
                resultFeatures.push(symbolFeature);
            }
        }
    }

    // Merge state from SourceCache into the results
    for (const layerName in result) {
        result[layerName].forEach((featureWrapper) => {
            const feature = featureWrapper.feature;
            const layer = styleLayers[layerName];
            const sourceCache = sourceCaches[layer.source];
            const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
            feature.source = feature.layer.source;
            if (feature.layer['source-layer']) {
                feature.sourceLayer = feature.layer['source-layer'];
            }
            feature.state = state;
        });
    }
    return result;
}

export function querySourceFeatures(sourceCache: SourceCache, params: any) {
    const tiles = sourceCache.getRenderableIds().map((id) => {
        return sourceCache.getTileByID(id);
    });

    const result = [];

    const dataTiles = {};
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const dataID = tile.tileID.canonical.key;
        if (!dataTiles[dataID]) {
            dataTiles[dataID] = true;
            tile.querySourceFeatures(result, params);
        }
    }

    return result;
}

function sortTilesIn(a, b) {
    const idA = a.tileID;
    const idB = b.tileID;
    return (idA.overscaledZ - idB.overscaledZ) || (idA.canonical.y - idB.canonical.y) || (idA.wrap - idB.wrap) || (idA.canonical.x - idB.canonical.x);
}

function mergeRenderedFeatureLayers(tiles) {
    // Merge results from all tiles, but if two tiles share the same
    // wrapped ID, don't duplicate features between the two tiles
    const result = {};
    const wrappedIDLayerMap = {};
    for (const tile of tiles) {
        const queryResults = tile.queryResults;
        const wrappedID = tile.wrappedTileID;
        const wrappedIDLayers = wrappedIDLayerMap[wrappedID] = wrappedIDLayerMap[wrappedID] || {};
        for (const layerID in queryResults) {
            const tileFeatures = queryResults[layerID];
            const wrappedIDFeatures = wrappedIDLayers[layerID] = wrappedIDLayers[layerID] || {};
            const resultFeatures = result[layerID] = result[layerID] || [];
            for (const tileFeature of tileFeatures) {
                if (!wrappedIDFeatures[tileFeature.featureIndex]) {
                    wrappedIDFeatures[tileFeature.featureIndex] = true;
                    resultFeatures.push(tileFeature);
                }
            }
        }
    }
    return result;
}
