// Dependencies
var Colors = require("./colors");

/**
 * FlatColors
 * Finds the nearest flat color for rgb and hex inputs.
 *
 * @name FlatColors
 * @function
 * @param {String|Number|Array|undefined} r The color as string in hex format, the *red* value or the rgb passed as array. If `undefined`, a random color will be returned.
 * @param {Number} g The green value.
 * @param {Number} b The blue value.
 * @return {Array} An array containing the rgb values of the flat color which was found.
 */
function FlatColors(r, g, b) {

    if (r === undefined) {
        return Colors[Math.floor(Math.random() * Colors.length)];
    }

    if (typeof r === "string" && r.charAt(0) === "#") {
        return FlatColors(FlatColors.toRgb(r));
    }

    var rgb = Array.isArray(r) ? r : [ r, g, b ]
      , best = null
      ;

    for (var i = 0; i < Colors.length; ++i) {
        var d = distance(Colors[i], rgb)
        if (!best || d <= best.distance) {
            best = { distance : d, index : i };
        }
    }

    return Colors[best.index];
}

/**
 * toRgb
 * Converts a hex format color into rgb.
 *
 * @name toRgb
 * @function
 * @param {String} hex The color in the hex format.
 * @return {Array|null} The rgb array or null.
 */
FlatColors.toRgb = function (hex) {
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16)
      , parseInt(result[2], 16)
      , parseInt(result[3], 16)
    ] : null;
};

FlatColors.colors = Colors;

function distance (a, b) {
    return Math.sqrt(
        Math.pow(a[0] - b[0], 2)
      + Math.pow(a[1] - b[1], 2)
      + Math.pow(a[2] - b[2], 2)
    )
}

module.exports = FlatColors;
