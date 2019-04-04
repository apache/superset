var Dimension = require('../tree/dimension'),
    Anonymous = require('../tree/anonymous'),
    functionRegistry = require('./function-registry'),
    mathHelper = require('./math-helper.js');

var minMax = function (isMin, args) {
    args = Array.prototype.slice.call(args);
    switch (args.length) {
        case 0: throw { type: 'Argument', message: 'one or more arguments required' };
    }
    var i, j, current, currentUnified, referenceUnified, unit, unitStatic, unitClone,
        order  = [], // elems only contains original argument values.
        values = {}; // key is the unit.toString() for unified Dimension values,
    // value is the index into the order array.
    for (i = 0; i < args.length; i++) {
        current = args[i];
        if (!(current instanceof Dimension)) {
            if (Array.isArray(args[i].value)) {
                Array.prototype.push.apply(args, Array.prototype.slice.call(args[i].value));
            }
            continue;
        }
        currentUnified = current.unit.toString() === '' && unitClone !== undefined ? new Dimension(current.value, unitClone).unify() : current.unify();
        unit = currentUnified.unit.toString() === '' && unitStatic !== undefined ? unitStatic : currentUnified.unit.toString();
        unitStatic = unit !== '' && unitStatic === undefined || unit !== '' && order[0].unify().unit.toString() === '' ? unit : unitStatic;
        unitClone = unit !== '' && unitClone === undefined ? current.unit.toString() : unitClone;
        j = values[''] !== undefined && unit !== '' && unit === unitStatic ? values[''] : values[unit];
        if (j === undefined) {
            if (unitStatic !== undefined && unit !== unitStatic) {
                throw { type: 'Argument', message: 'incompatible types' };
            }
            values[unit] = order.length;
            order.push(current);
            continue;
        }
        referenceUnified = order[j].unit.toString() === '' && unitClone !== undefined ? new Dimension(order[j].value, unitClone).unify() : order[j].unify();
        if ( isMin && currentUnified.value < referenceUnified.value ||
            !isMin && currentUnified.value > referenceUnified.value) {
            order[j] = current;
        }
    }
    if (order.length == 1) {
        return order[0];
    }
    args = order.map(function (a) { return a.toCSS(this.context); }).join(this.context.compress ? ',' : ', ');
    return new Anonymous((isMin ? 'min' : 'max') + '(' + args + ')');
};
functionRegistry.addMultiple({
    min: function () {
        return minMax(true, arguments);
    },
    max: function () {
        return minMax(false, arguments);
    },
    convert: function (val, unit) {
        return val.convertTo(unit.value);
    },
    pi: function () {
        return new Dimension(Math.PI);
    },
    mod: function(a, b) {
        return new Dimension(a.value % b.value, a.unit);
    },
    pow: function(x, y) {
        if (typeof x === 'number' && typeof y === 'number') {
            x = new Dimension(x);
            y = new Dimension(y);
        } else if (!(x instanceof Dimension) || !(y instanceof Dimension)) {
            throw { type: 'Argument', message: 'arguments must be numbers' };
        }

        return new Dimension(Math.pow(x.value, y.value), x.unit);
    },
    percentage: function (n) {
        var result = mathHelper._math(function(num) {
            return num * 100;
        }, '%', n);

        return result;
    }
});
