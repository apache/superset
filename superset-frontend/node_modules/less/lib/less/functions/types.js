var Keyword = require('../tree/keyword'),
    DetachedRuleset = require('../tree/detached-ruleset'),
    Dimension = require('../tree/dimension'),
    Color = require('../tree/color'),
    Quoted = require('../tree/quoted'),
    Anonymous = require('../tree/anonymous'),
    URL = require('../tree/url'),
    Operation = require('../tree/operation'),
    functionRegistry = require('./function-registry');

var isa = function (n, Type) {
        return (n instanceof Type) ? Keyword.True : Keyword.False;
    },
    isunit = function (n, unit) {
        if (unit === undefined) {
            throw { type: 'Argument', message: 'missing the required second argument to isunit.' };
        }
        unit = typeof unit.value === 'string' ? unit.value : unit;
        if (typeof unit !== 'string') {
            throw { type: 'Argument', message: 'Second argument to isunit should be a unit or a string.' };
        }
        return (n instanceof Dimension) && n.unit.is(unit) ? Keyword.True : Keyword.False;
    };

functionRegistry.addMultiple({
    isruleset: function (n) {
        return isa(n, DetachedRuleset);
    },
    iscolor: function (n) {
        return isa(n, Color);
    },
    isnumber: function (n) {
        return isa(n, Dimension);
    },
    isstring: function (n) {
        return isa(n, Quoted);
    },
    iskeyword: function (n) {
        return isa(n, Keyword);
    },
    isurl: function (n) {
        return isa(n, URL);
    },
    ispixel: function (n) {
        return isunit(n, 'px');
    },
    ispercentage: function (n) {
        return isunit(n, '%');
    },
    isem: function (n) {
        return isunit(n, 'em');
    },
    isunit: isunit,
    unit: function (val, unit) {
        if (!(val instanceof Dimension)) {
            throw { type: 'Argument',
                message: 'the first argument to unit must be a number' +
                    (val instanceof Operation ? '. Have you forgotten parenthesis?' : '') };
        }
        if (unit) {
            if (unit instanceof Keyword) {
                unit = unit.value;
            } else {
                unit = unit.toCSS();
            }
        } else {
            unit = '';
        }
        return new Dimension(val.value, unit);
    },
    'get-unit': function (n) {
        return new Anonymous(n.unit);
    }
});
