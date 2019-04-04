var Node = require('./node'),
    Operation = require('./operation'),
    Dimension = require('./dimension');

var Negative = function (node) {
    this.value = node;
};
Negative.prototype = new Node();
Negative.prototype.type = 'Negative';
Negative.prototype.genCSS = function (context, output) {
    output.add('-');
    this.value.genCSS(context, output);
};
Negative.prototype.eval = function (context) {
    if (context.isMathOn()) {
        return (new Operation('*', [new Dimension(-1), this.value])).eval(context);
    }
    return new Negative(this.value.eval(context));
};
module.exports = Negative;
