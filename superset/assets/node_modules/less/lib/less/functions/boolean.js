
var functionRegistry = require('./function-registry'),
    Anonymous = require('../tree/anonymous'),
    Keyword = require('../tree/keyword');

functionRegistry.addMultiple({
    boolean: function(condition) {
        return condition ? Keyword.True : Keyword.False;
    },

    'if': function(condition, trueValue, falseValue) {
        return condition ? trueValue
            : (falseValue || new Anonymous);
    }
});
