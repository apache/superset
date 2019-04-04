var Node = require('./node'),
    Anonymous = require('./anonymous'),
    FunctionCaller = require('../functions/function-caller');
//
// A function call node.
//
var Call = function (name, args, index, currentFileInfo) {
    this.name = name;
    this.args = args;
    this.calc = name === 'calc';
    this._index = index;
    this._fileInfo = currentFileInfo;
};
Call.prototype = new Node();
Call.prototype.type = 'Call';
Call.prototype.accept = function (visitor) {
    if (this.args) {
        this.args = visitor.visitArray(this.args);
    }
};
//
// When evaluating a function call,
// we either find the function in the functionRegistry,
// in which case we call it, passing the  evaluated arguments,
// if this returns null or we cannot find the function, we
// simply print it out as it appeared originally [2].
//
// The reason why we evaluate the arguments, is in the case where
// we try to pass a variable to a function, like: `saturate(@color)`.
// The function should receive the value, not the variable.
//
Call.prototype.eval = function (context) {
    /**
     * Turn off math for calc(), and switch back on for evaluating nested functions
     */
    var currentMathContext = context.mathOn;
    context.mathOn = !this.calc;
    if (this.calc || context.inCalc) {
        context.enterCalc();
    }
    var args = this.args.map(function (a) { return a.eval(context); });
    if (this.calc || context.inCalc) {
        context.exitCalc();
    }
    context.mathOn = currentMathContext;

    var result, funcCaller = new FunctionCaller(this.name, context, this.getIndex(), this.fileInfo());
    
    if (funcCaller.isValid()) {
        try {
            result = funcCaller.call(args);
        } catch (e) {
            throw { 
                type: e.type || 'Runtime',
                message: 'error evaluating function `' + this.name + '`' +
                         (e.message ? ': ' + e.message : ''),
                index: this.getIndex(), 
                filename: this.fileInfo().filename,
                line: e.lineNumber,
                column: e.columnNumber
            };
        }

        if (result !== null && result !== undefined) {
            // Results that that are not nodes are cast as Anonymous nodes
            // Falsy values or booleans are returned as empty nodes
            if (!(result instanceof Node)) {
                if (!result || result === true) {
                    result = new Anonymous(null); 
                }
                else {
                    result = new Anonymous(result.toString()); 
                }
                
            }
            result._index = this._index;
            result._fileInfo = this._fileInfo;
            return result;
        }

    }

    return new Call(this.name, args, this.getIndex(), this.fileInfo());
};
Call.prototype.genCSS = function (context, output) {
    output.add(this.name + '(', this.fileInfo(), this.getIndex());

    for (var i = 0; i < this.args.length; i++) {
        this.args[i].genCSS(context, output);
        if (i + 1 < this.args.length) {
            output.add(', ');
        }
    }

    output.add(')');
};
module.exports = Call;
