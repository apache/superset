var Node = require('./node'),
    Color = require('./color'),
    Dimension = require('./dimension'),
    MATH = require('../constants').Math;

var Operation = function (op, operands, isSpaced) {
    this.op = op.trim();
    this.operands = operands;
    this.isSpaced = isSpaced;
};
Operation.prototype = new Node();
Operation.prototype.type = 'Operation';
Operation.prototype.accept = function (visitor) {
    this.operands = visitor.visit(this.operands);
};
Operation.prototype.eval = function (context) {
    var a = this.operands[0].eval(context),
        b = this.operands[1].eval(context),
        op;

    if (context.isMathOn(this.op)) {
        op = this.op === './' ? '/' : this.op;
        if (a instanceof Dimension && b instanceof Color) {
            a = a.toColor();
        }
        if (b instanceof Dimension && a instanceof Color) {
            b = b.toColor();
        }
        if (!a.operate) {
            if (a instanceof Operation && a.op === '/' && context.math === MATH.PARENS_DIVISION) {
                return new Operation(this.op, [a, b], this.isSpaced);
            }
            throw { type: 'Operation',
                message: 'Operation on an invalid type' };
        }

        return a.operate(context, op, b);
    } else {
        return new Operation(this.op, [a, b], this.isSpaced);
    }
};
Operation.prototype.genCSS = function (context, output) {
    this.operands[0].genCSS(context, output);
    if (this.isSpaced) {
        output.add(' ');
    }
    output.add(this.op);
    if (this.isSpaced) {
        output.add(' ');
    }
    this.operands[1].genCSS(context, output);
};

module.exports = Operation;
