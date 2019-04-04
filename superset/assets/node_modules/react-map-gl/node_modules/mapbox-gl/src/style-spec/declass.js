
import extend from './util/extend';

export default declassStyle;

/**
 * Returns a new style with the given 'paint classes' merged into each layer's
 * main `paint` definiton, and with all `paint.*` properties removed.
 *
 * @private
 * @param {Object} style A style JSON object.
 * @param {Array<string>} classes An array of paint classes to apply, in order.
 *
 * @example
 * var declass = require('mapbox-gl-style-spec/lib/declass')
 * var baseStyle = { ... style with a 'paint.night' property in some layers ... }
 * var nightStyle = declass(baseStyle, ['night'])
 * // nightStyle now has each layer's `paint.night` properties merged in to the
 * // main `paint` property.
 */
function declassStyle(style, classes) {
    return extend({}, style, {
        layers: style.layers.map((layer) => {
            const result = classes.reduce(declassLayer, layer);

            // strip away all `paint.CLASS` definitions
            for (const key in result) {
                if (/paint\..*/.test(key)) {
                    delete result[key];
                }
            }

            return result;
        })
    });
}

function declassLayer(layer, klass) {
    return extend({}, layer, {
        paint: extend({}, layer.paint, layer[`paint.${klass}`])
    });
}
