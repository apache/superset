// @flow

import { normalizeGlyphsURL } from '../util/mapbox';

import { getArrayBuffer, ResourceType } from '../util/ajax';

import parseGlyphPBF from './parse_glyph_pbf';

import type {StyleGlyph} from './style_glyph';
import type {RequestTransformFunction} from '../ui/map';
import type {Callback} from '../types/callback';

export default function (fontstack: string,
                           range: number,
                           urlTemplate: string,
                           requestTransform: RequestTransformFunction,
                           callback: Callback<{[number]: StyleGlyph | null}>) {
    const begin = range * 256;
    const end = begin + 255;

    const request = requestTransform(
        normalizeGlyphsURL(urlTemplate)
            .replace('{fontstack}', fontstack)
            .replace('{range}', `${begin}-${end}`),
        ResourceType.Glyphs);

    getArrayBuffer(request, (err: ?Error, data: ?ArrayBuffer) => {
        if (err) {
            callback(err);
        } else if (data) {
            const glyphs = {};

            for (const glyph of parseGlyphPBF(data)) {
                glyphs[glyph.id] = glyph;
            }

            callback(null, glyphs);
        }
    });
}
