var Node = require('./node'),
    Paren = require('./paren'),
    Comment = require('./comment'),
    Dimension = require('./dimension'),
    MATH = require('../constants').Math;

var Expression = function (value, noSpacing) {
    this.value = value;
    this.noSpacing = noSpacing;
    if (!value) {
        throw new Error('Expression requires an array parameter');
    }
};
Expression.prototype = new Node();
Expression.prototype.type = 'Expression';
Expression.prototype.accept = function (visitor) {
    this.value = visitor.visitArray(this.value);
};
Expression.prototype.eval = function (context) {
    var returnValue,
        mathOn = context.isMathOn(),
        inParenthesis = this.parens && 
            (context.math !== MATH.STRICT_LEGACY || !this.parensInOp),
        doubleParen = false;
    if (inParenthesis) {
        context.inParenthesis();
    }
    if (this.value.length > 1) {
        returnValue = new Expression(this.value.map(function (e) {
            if (!e.eval) {
                return e;
            }
            return e.eval(context);
        }), this.noSpacing);
    } else if (this.value.length === 1) {
        if (this.value[0].parens && !this.value[0].parensInOp && !context.inCalc) {
            doubleParen = true;
        }
        returnValue = this.value[0].eval(context);
    } else {
        returnValue = this;
    }
    if (inParenthesis) {
        context.outOfParenthesis();
    }
    if (this.parens && this.parensInOp && !mathOn && !doubleParen 
        && (!(returnValue instanceof Dimension))) {
        returnValue = new Paren(returnValue);
    }
    return returnValue;
};
Expression.prototype.genCSS = function (context, output) {
    for (var i = 0; i < this.value.length; i++) {
        this.value[i].genCSS(context, output);
        if (!this.noSpacing && i + 1 < this.value.length) {
            output.add(' ');
        }
    }
};
Expression.prototype.throwAwayComments = function () {
    this.value = this.value.filter(function(v) {
        return !(v instanceof Comment);
    });
};
module.exports = Expression;
