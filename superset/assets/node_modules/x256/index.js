// colors scraped from
// http://www.calmar.ws/vim/256-xterm-24bit-rgb-color-chart.html
// %s/ *\d\+ \+#\([^ ]\+\)/\1\r/g

var colors = require('./colors.json')
    .map(function (hex) {
        var r = parseInt(hex.slice(0,2), 16);
        var g = parseInt(hex.slice(2,4), 16);
        var b = parseInt(hex.slice(4,6), 16);
        return [ r, g, b ];
    })
;

var x256 = module.exports = function (r, g, b) {
    var c = Array.isArray(r) ? r : [ r, g, b ];
    var best = null;
    
    for (var i = 0; i < colors.length; i++) {
        var d = distance(colors[i], c)
        if (!best || d <= best.distance) {
            best = { distance : d, index : i };
        }
    }
    
    return best.index;
};
x256.colors = colors;

function distance (a, b) {
    return Math.sqrt(
        Math.pow(a[0]-b[0], 2)
        + Math.pow(a[1]-b[1], 2)
        + Math.pow(a[2]-b[2], 2)
    )
}
