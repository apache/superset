
import validateStyleMin from './validate_style.min';
import ParsingError from './error/parsing_error';
import jsonlint from '@mapbox/jsonlint-lines-primitives';
import {v8} from './style-spec';

/**
 * Validate a Mapbox GL style against the style specification.
 *
 * @private
 * @alias validate
 * @param {Object|String|Buffer} style The style to be validated. If a `String`
 *     or `Buffer` is provided, the returned errors will contain line numbers.
 * @param {Object} [styleSpec] The style specification to validate against.
 *     If omitted, the spec version is inferred from the stylesheet.
 * @returns {Array<ValidationError|ParsingError>}
 * @example
 *   var validate = require('mapbox-gl-style-spec').validate;
 *   var style = fs.readFileSync('./style.json', 'utf8');
 *   var errors = validate(style);
 */

export default function validateStyle(style, styleSpec) {
    if (style instanceof String || typeof style === 'string' || style instanceof Buffer) {
        try {
            style = jsonlint.parse(style.toString());
        } catch (e) {
            return [new ParsingError(e)];
        }
    }

    styleSpec = styleSpec || v8;

    return validateStyleMin(style, styleSpec);
}

export const source = validateStyleMin.source;
export const light = validateStyleMin.light;
export const layer = validateStyleMin.layer;
export const filter = validateStyleMin.filter;
export const paintProperty = validateStyleMin.paintProperty;
export const layoutProperty = validateStyleMin.layoutProperty;
