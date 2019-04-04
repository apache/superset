var JsEvalNode = require('./js-eval-node'),
    Dimension = require('./dimension'),
    Quoted = require('./quoted'),
    Anonymous = require('./anonymous');

var JavaScript = function (string, escaped, index, currentFileInfo) {
    this.escaped = escaped;
    this.expression = string;
    this._index = index;
    this._fileInfo = currentFileInfo;
};
JavaScript.prototype = new JsEvalNode();
JavaScript.prototype.type = 'JavaScript';
JavaScript.prototype.eval = function(context) {
    var result = this.evaluateJavaScript(this.expression, context);
    var type = typeof result;

    if (type === 'number' && !isNaN(result)) {
        return new Dimension(result);
    } else if (type === 'string') {
        return new Quoted('"' + result + '"', result, this.escaped, this._index);
    } else if (Array.isArray(result)) {
        return new Anonymous(result.join(', '));
    } else {
        return new Anonymous(result);
    }
};

module.exports = JavaScript;
