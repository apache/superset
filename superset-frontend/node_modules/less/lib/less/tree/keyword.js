var Node = require('./node');

var Keyword = function (value) { this.value = value; };
Keyword.prototype = new Node();
Keyword.prototype.type = 'Keyword';
Keyword.prototype.genCSS = function (context, output) {
    if (this.value === '%') { throw { type: 'Syntax', message: 'Invalid % without number' }; }
    output.add(this.value);
};

Keyword.True = new Keyword('true');
Keyword.False = new Keyword('false');

module.exports = Keyword;
