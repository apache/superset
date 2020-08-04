// @flow

import { getJSON, getImage, ResourceType } from '../util/ajax';

import browser from '../util/browser';
import { normalizeSpriteURL } from '../util/mapbox';
import { RGBAImage } from '../util/image';

import type {StyleImage} from './style_image';
import type {RequestTransformFunction} from '../ui/map';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

export default function(baseURL: string,
                          transformRequestCallback: RequestTransformFunction,
                          callback: Callback<{[string]: StyleImage}>): Cancelable {
    let json: any, image, error;
    const format = browser.devicePixelRatio > 1 ? '@2x' : '';

    let jsonRequest = getJSON(transformRequestCallback(normalizeSpriteURL(baseURL, format, '.json'), ResourceType.SpriteJSON), (err: ?Error, data: ?Object) => {
        jsonRequest = null;
        if (!error) {
            error = err;
            json = data;
            maybeComplete();
        }
    });

    let imageRequest = getImage(transformRequestCallback(normalizeSpriteURL(baseURL, format, '.png'), ResourceType.SpriteImage), (err, img) => {
        imageRequest = null;
        if (!error) {
            error = err;
            image = img;
            maybeComplete();
        }
    });

    function maybeComplete() {
        if (error) {
            callback(error);
        } else if (json && image) {
            const imageData = browser.getImageData(image);
            const result = {};

            for (const id in json) {
                const {width, height, x, y, sdf, pixelRatio} = json[id];
                const data = new RGBAImage({width, height});
                RGBAImage.copy(imageData, data, {x, y}, {x: 0, y: 0}, {width, height});
                result[id] = {data, pixelRatio, sdf};
            }

            callback(null, result);
        }
    }

    return {
        cancel() {
            if (jsonRequest) {
                jsonRequest.cancel();
                jsonRequest = null;
            }
            if (imageRequest) {
                imageRequest.cancel();
                imageRequest = null;
            }
        }
    };
}
