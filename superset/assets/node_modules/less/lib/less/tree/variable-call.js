var Node = require('./node'),
    Variable = require('./variable'),
    Ruleset = require('./ruleset'),
    DetachedRuleset = require('./detached-ruleset'),
    LessError = require('../less-error');

var VariableCall = function (variable, index, currentFileInfo) {
    this.variable = variable;
    this._index = index;
    this._fileInfo = currentFileInfo;
    this.allowRoot = true;
};
VariableCall.prototype = new Node();
VariableCall.prototype.type = 'VariableCall';
VariableCall.prototype.eval = function (context) {
    var rules, detachedRuleset = new Variable(this.variable, this.getIndex(), this.fileInfo()).eval(context),
        error = new LessError({message: 'Could not evaluate variable call ' + this.variable});

    if (!detachedRuleset.ruleset) {
        if (detachedRuleset.rules) {
            rules = detachedRuleset;
        }
        else if (Array.isArray(detachedRuleset)) {
            rules = new Ruleset('', detachedRuleset);
        }
        else if (Array.isArray(detachedRuleset.value)) {
            rules = new Ruleset('', detachedRuleset.value);
        }
        else {
            throw error;
        }
        detachedRuleset = new DetachedRuleset(rules);
    }
    if (detachedRuleset.ruleset) {
        return detachedRuleset.callEval(context);
    }
    throw error;
};
module.exports = VariableCall;
