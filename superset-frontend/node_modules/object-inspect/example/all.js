var inspect = require('../');
var holes = [ 'a', 'b' ];
holes[4] = 'e', holes[6] = 'g';
var obj = {
    a: 1,
    b: [ 3, 4, undefined, null ],
    c: undefined,
    d: null,
    e: {
        regex: /^x/i,
        buf: new Buffer('abc'),
        holes: holes
    },
    now: new Date
};
obj.self = obj;
console.log(inspect(obj));
