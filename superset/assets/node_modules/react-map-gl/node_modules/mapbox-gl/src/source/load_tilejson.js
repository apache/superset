// @flow

import { pick } from '../util/util';

import { getJSON, ResourceType } from '../util/ajax';
import browser from '../util/browser';
import { normalizeSourceURL as normalizeURL, canonicalizeTileset } from '../util/mapbox';

import type {RequestTransformFunction} from '../ui/map';
import type {Callback} from '../types/callback';
import type {TileJSON} from '../types/tilejson';
import type {Cancelable} from '../types/cancelable';

export default function(options: any, requestTransformFn: RequestTransformFunction, callback: Callback<TileJSON>): Cancelable {
    const loaded = function(err: ?Error, tileJSON: ?Object) {
        if (err) {
            return callback(err);
        } else if (tileJSON) {
            const result: any = pick(
                tileJSON,
                ['tiles', 'minzoom', 'maxzoom', 'attribution', 'mapbox_logo', 'bounds']
            );

            if (tileJSON.vector_layers) {
                result.vectorLayers = tileJSON.vector_layers;
                result.vectorLayerIds = result.vectorLayers.map((layer) => { return layer.id; });
            }

            // only canonicalize tile tileset if source is declared using a tilejson url
            if (options.url) {
                result.tiles = canonicalizeTileset(result, options.url);
            }
            callback(null, result);
        }
    };

    if (options.url) {
        return getJSON(requestTransformFn(normalizeURL(options.url), ResourceType.Source), loaded);
    } else {
        return browser.frame(() => loaded(null, options));
    }
}
