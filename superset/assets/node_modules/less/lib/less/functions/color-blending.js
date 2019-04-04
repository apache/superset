var Color = require('../tree/color'),
    functionRegistry = require('./function-registry');

// Color Blending
// ref: http://www.w3.org/TR/compositing-1

function colorBlend(mode, color1, color2) {
    var ab = color1.alpha, cb, // backdrop
        as = color2.alpha, cs, // source
        ar, cr, r = [];        // result

    ar = as + ab * (1 - as);
    for (var i = 0; i < 3; i++) {
        cb = color1.rgb[i] / 255;
        cs = color2.rgb[i] / 255;
        cr = mode(cb, cs);
        if (ar) {
            cr = (as * cs + ab * (cb -
                  as * (cb + cs - cr))) / ar;
        }
        r[i] = cr * 255;
    }

    return new Color(r, ar);
}

var colorBlendModeFunctions = {
    multiply: function(cb, cs) {
        return cb * cs;
    },
    screen: function(cb, cs) {
        return cb + cs - cb * cs;
    },
    overlay: function(cb, cs) {
        cb *= 2;
        return (cb <= 1) ?
            colorBlendModeFunctions.multiply(cb, cs) :
            colorBlendModeFunctions.screen(cb - 1, cs);
    },
    softlight: function(cb, cs) {
        var d = 1, e = cb;
        if (cs > 0.5) {
            e = 1;
            d = (cb > 0.25) ? Math.sqrt(cb)
                : ((16 * cb - 12) * cb + 4) * cb;
        }
        return cb - (1 - 2 * cs) * e * (d - cb);
    },
    hardlight: function(cb, cs) {
        return colorBlendModeFunctions.overlay(cs, cb);
    },
    difference: function(cb, cs) {
        return Math.abs(cb - cs);
    },
    exclusion: function(cb, cs) {
        return cb + cs - 2 * cb * cs;
    },

    // non-w3c functions:
    average: function(cb, cs) {
        return (cb + cs) / 2;
    },
    negation: function(cb, cs) {
        return 1 - Math.abs(cb + cs - 1);
    }
};

for (var f in colorBlendModeFunctions) {
    if (colorBlendModeFunctions.hasOwnProperty(f)) {
        colorBlend[f] = colorBlend.bind(null, colorBlendModeFunctions[f]);
    }
}

functionRegistry.addMultiple(colorBlend);
