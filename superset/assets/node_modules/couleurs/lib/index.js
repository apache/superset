// Dependencies
var x256 = require("x256")
  , Typpy = require("typpy")
  ;

// Constants
const MAP = {
    bold: [ "\u001b[1m", "\u001b[22m" ]
  , italic: [ "\u001b[3m", "\u001b[23m" ]
  , underline: [ "\u001b[4m", "\u001b[24m" ]
  , inverse: [ "\u001b[7m", "\u001b[27m" ]
  , strike: [ "\u001b[9m", "\u001b[29m" ]
  , fg: ["\u001b[38;5;", "\u001b[39m"]
  , bg: ["\u001b[48;5;", "\u001b[49m"]
};

/**
 * Couleurs
 *
 * @name Couleurs
 * @function
 * @param {Boolean|undefined} setStringProto If `true`, the prototype of String
 * class will be modified.
 * @param {String|Array} fg An optional foreground color.
 * @return {String|Object} The colored string if the `fg` argument was provided
 * or an object containing the following methods:
 *
 *  - `proto`
 *  - `toString`
 *  - `fg`
 *  - `bg`
 *  - `bold`
 *  - `italic`
 *  - `underline`
 *  - `inverse`
 *  - `strike`
 *
 */
function Couleurs(text, fg) {
    var self = this;
    if (Typpy(self) !== "couleurs" && Typpy(fg) === "undefined") {
        return new Couleurs(text, fg);
    }
    self.text = text;
    self.styles = [];
    if (/array|string/.test(Typpy(fg))) {
        return Couleurs.fg(text, fg);
    }
}

/**
 * Couleurs.hexToRgb
 * Converts a hex color code to rgb
 *
 * @name hexToRgb
 * @function
 * @param {String} hex The hex color value.
 * @return {Array|null} An array containing `r`, `g`, `b` values. If the input is invalid, `null` will be returned.
 */
Couleurs.hexToRgb = function (hex) {
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
};

function prepareHandler(text, r, g, b) {

    if (Typpy(this.text) === "string") {
        r = text;
        text = this.text;
    }

    var res = {
        color: ""
      , text: text
    };

    if (Typpy(r) === "string" && r[0] === "#") {
        res.color = x256(Couleurs.hexToRgb(r));
    } else {
        if (/^string|array|number$/.test(Typpy(r))) {
            res.color = x256(r, g, b);
        }
    }

    return res;
}

function toStr(start, color, text, m, end) {
    return [start, color, m !== false ? "m" : "", text, end].join("");
}

function genMeth(start, end, m) {
    return function (str, r, g, b) {
        var res = prepareHandler.apply(this, arguments);
        if (Typpy(this.text) === "string") {
            this.styles.push([
                start
              , end
              , res
              , m
            ]);
            return this;
        }
        return toStr(start, res.color, res.text, m, end);
    }
}

/**
 * toString
 * Converts the internal object into string.
 *
 * @name toString
 * @function
 * @return {String} Stringifies the couleurs internal data using ANSI styles.
 */
Couleurs.prototype.toString = function () {

    var self = this
      , str = self.text
      ;

    self.styles.forEach(function (c) {
        str = toStr(c[0], c[2].color, str, c[3], c[1]);
    });

    return str;
};

Object.keys(MAP).forEach(function (s) {
    Couleurs[s] = Couleurs.prototype[s] = genMeth(MAP[s][0], MAP[s][1], /^fg|bg$/.test(s) ? true : false);
});

/**
 * proto
 * Modifies the `String` prototype to contain the `Couleurs` methods.
 *
 * @name proto
 * @function
 */
Couleurs.proto = function () {
    Object.keys(MAP).forEach(function (c) {
        String.prototype[c] = function (r, g, b) {
            return Couleurs[c](String(this), r, g, b);
        };
    });
};

module.exports = Couleurs;
