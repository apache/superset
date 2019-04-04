var test = require('tape');
var x256 = require('../');

function fudge (x) {
    return Math.max(0, Math.min(255, Math.round(
        x + Math.random() * 10 - 5
    )));
}

test(function (t) {
    t.plan(256 + 2);
    
    t.equal(x256.colors.length, 256);
    var missed = 0;
    
    x256.colors.forEach(function (color, ix) {
        var c = x256(color);
        if (ix < 16 && c >= 16) {
            t.same(x256.colors[c], x256.colors[ix]);
        }
        else {
            t.equal(c, ix);
        }
        
        var i = x256([
            fudge(color[0]),
            fudge(color[1]),
            fudge(color[2])
        ]);
        if (i !== c && i !== ix) missed ++;
    });
    
    t.ok(missed < 10, 'missed=' + missed);
    
    t.end();
});
