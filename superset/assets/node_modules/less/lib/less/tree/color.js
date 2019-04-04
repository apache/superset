var Node = require('./node'),
    colors = require('../data/colors');

//
// RGB Colors - #ff0014, #eee
//
var Color = function (rgb, a, originalForm) {
    var self = this;
    //
    // The end goal here, is to parse the arguments
    // into an integer triplet, such as `128, 255, 0`
    //
    // This facilitates operations and conversions.
    //
    if (Array.isArray(rgb)) {
        this.rgb = rgb;
    } else if (rgb.length >= 6) {
        this.rgb = [];
        rgb.match(/.{2}/g).map(function (c, i) {
            if (i < 3) {
                self.rgb.push(parseInt(c, 16));
            } else {
                self.alpha = (parseInt(c, 16)) / 255;
            }
        });
    } else {
        this.rgb = [];
        rgb.split('').map(function (c, i) {
            if (i < 3) {
                self.rgb.push(parseInt(c + c, 16));
            } else {
                self.alpha = (parseInt(c + c, 16)) / 255;
            }
        });
    }
    this.alpha = this.alpha || (typeof a === 'number' ? a : 1);
    if (typeof originalForm !== 'undefined') {
        this.value = originalForm;
    }
};

Color.prototype = new Node();
Color.prototype.type = 'Color';

function clamp(v, max) {
    return Math.min(Math.max(v, 0), max);
}

function toHex(v) {
    return '#' + v.map(function (c) {
        c = clamp(Math.round(c), 255);
        return (c < 16 ? '0' : '') + c.toString(16);
    }).join('');
}

Color.prototype.luma = function () {
    var r = this.rgb[0] / 255,
        g = this.rgb[1] / 255,
        b = this.rgb[2] / 255;

    r = (r <= 0.03928) ? r / 12.92 : Math.pow(((r + 0.055) / 1.055), 2.4);
    g = (g <= 0.03928) ? g / 12.92 : Math.pow(((g + 0.055) / 1.055), 2.4);
    b = (b <= 0.03928) ? b / 12.92 : Math.pow(((b + 0.055) / 1.055), 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
Color.prototype.genCSS = function (context, output) {
    output.add(this.toCSS(context));
};
Color.prototype.toCSS = function (context, doNotCompress) {
    var compress = context && context.compress && !doNotCompress, color, alpha,
        colorFunction, args = [];

    // `value` is set if this color was originally
    // converted from a named color string so we need
    // to respect this and try to output named color too.
    alpha = this.fround(context, this.alpha);

    if (this.value) {
        if (this.value.indexOf('rgb') === 0) {
            if (alpha < 1) {
                colorFunction = 'rgba';
            }
        } else if (this.value.indexOf('hsl') === 0) {
            if (alpha < 1) {
                colorFunction = 'hsla';
            } else {
                colorFunction = 'hsl';
            }
        } else {
            return this.value;
        }
    } else {
        if (alpha < 1) {
            colorFunction = 'rgba';
        }
    }

    switch (colorFunction) {
        case 'rgba':
            args = this.rgb.map(function (c) {
                return clamp(Math.round(c), 255);
            }).concat(clamp(alpha, 1));
            break;
        case 'hsla':
            args.push(clamp(alpha, 1));
        case 'hsl':
            color = this.toHSL();
            args = [
                this.fround(context, color.h),
                this.fround(context, color.s * 100) + '%',
                this.fround(context, color.l * 100) + '%'
            ].concat(args);
    }

    if (colorFunction) {
        // Values are capped between `0` and `255`, rounded and zero-padded.
        return colorFunction + '(' + args.join(',' + (compress ? '' : ' ')) + ')';
    }

    color = this.toRGB();

    if (compress) {
        var splitcolor = color.split('');

        // Convert color to short format
        if (splitcolor[1] === splitcolor[2] && splitcolor[3] === splitcolor[4] && splitcolor[5] === splitcolor[6]) {
            color = '#' + splitcolor[1] + splitcolor[3] + splitcolor[5];
        }
    }

    return color;
};

//
// Operations have to be done per-channel, if not,
// channels will spill onto each other. Once we have
// our result, in the form of an integer triplet,
// we create a new Color node to hold the result.
//
Color.prototype.operate = function (context, op, other) {
    var rgb = new Array(3);
    var alpha = this.alpha * (1 - other.alpha) + other.alpha;
    for (var c = 0; c < 3; c++) {
        rgb[c] = this._operate(context, op, this.rgb[c], other.rgb[c]);
    }
    return new Color(rgb, alpha);
};
Color.prototype.toRGB = function () {
    return toHex(this.rgb);
};
Color.prototype.toHSL = function () {
    var r = this.rgb[0] / 255,
        g = this.rgb[1] / 255,
        b = this.rgb[2] / 255,
        a = this.alpha;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2, d = max - min;

    if (max === min) {
        h = s = 0;
    } else {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2;               break;
            case b: h = (r - g) / d + 4;               break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s, l: l, a: a };
};
// Adapted from http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
Color.prototype.toHSV = function () {
    var r = this.rgb[0] / 255,
        g = this.rgb[1] / 255,
        b = this.rgb[2] / 255,
        a = this.alpha;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    if (max === 0) {
        s = 0;
    } else {
        s = d / max;
    }

    if (max === min) {
        h = 0;
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s, v: v, a: a };
};
Color.prototype.toARGB = function () {
    return toHex([this.alpha * 255].concat(this.rgb));
};
Color.prototype.compare = function (x) {
    return (x.rgb &&
        x.rgb[0] === this.rgb[0] &&
        x.rgb[1] === this.rgb[1] &&
        x.rgb[2] === this.rgb[2] &&
        x.alpha  === this.alpha) ? 0 : undefined;
};

Color.fromKeyword = function(keyword) {
    var c, key = keyword.toLowerCase();
    if (colors.hasOwnProperty(key)) {
        c = new Color(colors[key].slice(1));
    }
    else if (key === 'transparent') {
        c = new Color([0, 0, 0], 0);
    }

    if (c) {
        c.value = keyword;
        return c;
    }
};
module.exports = Color;
