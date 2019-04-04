var functionRegistry = require('./function-registry'),
    mathHelper = require('./math-helper.js');

var mathFunctions = {
    // name,  unit
    ceil:  null,
    floor: null,
    sqrt:  null,
    abs:   null,
    tan:   '',
    sin:   '',
    cos:   '',
    atan:  'rad',
    asin:  'rad',
    acos:  'rad'
};

for (var f in mathFunctions) {
    if (mathFunctions.hasOwnProperty(f)) {
        mathFunctions[f] = mathHelper._math.bind(null, Math[f], mathFunctions[f]);
    }
}

mathFunctions.round = function (n, f) {
    var fraction = typeof f === 'undefined' ? 0 : f.value;
    return mathHelper._math(function(num) { return num.toFixed(fraction); }, null, n);
};

functionRegistry.addMultiple(mathFunctions);
