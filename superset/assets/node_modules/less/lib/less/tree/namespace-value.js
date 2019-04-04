var Node = require('./node'),
    Variable = require('./variable'),
    Ruleset = require('./ruleset'),
    Selector = require('./selector');

var NamespaceValue = function (ruleCall, lookups, important, index, fileInfo) {
    this.value = ruleCall;
    this.lookups = lookups;
    this.important = important;
    this._index = index;
    this._fileInfo = fileInfo;
};
NamespaceValue.prototype = new Node();
NamespaceValue.prototype.type = 'NamespaceValue';
NamespaceValue.prototype.eval = function (context) {
    var i, j, name, rules = this.value.eval(context);
    
    for (i = 0; i < this.lookups.length; i++) {
        name = this.lookups[i];

        /**
         * Eval'd DRs return rulesets.
         * Eval'd mixins return rules, so let's make a ruleset if we need it.
         * We need to do this because of late parsing of values
         */
        if (Array.isArray(rules)) {
            rules = new Ruleset([new Selector()], rules);
        }

        if (name === '') {
            rules = rules.lastDeclaration();
        }
        else if (name.charAt(0) === '@') {
            if (name.charAt(1) === '@') {
                name = '@' + new Variable(name.substr(1)).eval(context).value;
            }
            if (rules.variables) {
                rules = rules.variable(name);
            }
            
            if (!rules) {
                throw { type: 'Name',
                    message: 'variable ' + name + ' not found',
                    filename: this.fileInfo().filename,
                    index: this.getIndex() };
            }
        }
        else {
            if (name.substring(0, 2) === '$@') {
                name = '$' + new Variable(name.substr(1)).eval(context).value;
            }
            else {
                name = name.charAt(0) === '$' ? name : '$' + name;
            }
            if (rules.properties) {
                rules = rules.property(name);
            }
        
            if (!rules) {
                throw { type: 'Name',
                    message: 'property "' + name.substr(1) + '" not found',
                    filename: this.fileInfo().filename,
                    index: this.getIndex() };
            }
            // Properties are an array of values, since a ruleset can have multiple props.
            // We pick the last one (the "cascaded" value)
            rules = rules[rules.length - 1];
        }

        if (rules.value) {
            rules = rules.eval(context).value;
        }
        if (rules.ruleset) {
            rules = rules.ruleset.eval(context);
        }
    }
    return rules;
};
module.exports = NamespaceValue;
