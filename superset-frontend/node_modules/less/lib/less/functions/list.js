var Comment = require('../tree/comment'),
    Dimension = require('../tree/dimension'),
    Declaration = require('../tree/declaration'),
    Expression = require('../tree/expression'),
    Ruleset = require('../tree/ruleset'),
    Selector = require('../tree/selector'),
    Element = require('../tree/element'),
    functionRegistry = require('./function-registry');

var getItemsFromNode = function(node) {
    // handle non-array values as an array of length 1
    // return 'undefined' if index is invalid
    var items = Array.isArray(node.value) ?
        node.value : Array(node);

    return items;
};

functionRegistry.addMultiple({
    _SELF: function(n) {
        return n;
    },
    extract: function(values, index) {
        index = index.value - 1; // (1-based index)

        return getItemsFromNode(values)[index];
    },
    length: function(values) {
        return new Dimension(getItemsFromNode(values).length);
    },
    /**
     * Creates a Less list of incremental values.
     * Modeled after Lodash's range function, also exists natively in PHP
     * 
     * @param {Dimension} [start=1]
     * @param {Dimension} end  - e.g. 10 or 10px - unit is added to output
     * @param {Dimension} [step=1] 
     */
    range: function(start, end, step) {
        var from, to, stepValue = 1, list = [];
        if (end) {
            to = end;
            from = start.value;
            if (step) {
                stepValue = step.value;
            }
        }
        else {
            from = 1;
            to = start;
        }

        for (var i = from; i <= to.value; i += stepValue) {
            list.push(new Dimension(i, to.unit));
        }

        return new Expression(list);
    },
    each: function(list, rs) {
        var rules = [], newRules, iterator;

        if (list.value) {
            if (Array.isArray(list.value)) {
                iterator = list.value;
            } else {
                iterator = [list.value];
            }
        } else if (list.ruleset) {
            iterator = list.ruleset.rules;
        } else if (list.rules) {
            iterator = list.rules;
        } else if (Array.isArray(list)) {
            iterator = list;
        } else {
            iterator = [list];
        }

        var valueName = '@value',
            keyName = '@key',
            indexName = '@index';

        if (rs.params) {
            valueName = rs.params[0] && rs.params[0].name;
            keyName = rs.params[1] && rs.params[1].name;
            indexName = rs.params[2] && rs.params[2].name;
            rs = rs.rules;
        } else {
            rs = rs.ruleset;
        }

        for (var i = 0; i < iterator.length; i++) {
            var key, value, item = iterator[i];
            if (item instanceof Declaration) {
                key = typeof item.name === 'string' ? item.name : item.name[0].value;
                value = item.value;
            } else {
                key = new Dimension(i + 1);
                value = item;
            }
            
            if (item instanceof Comment) {
                continue;
            }

            newRules = rs.rules.slice(0);
            if (valueName) {
                newRules.push(new Declaration(valueName,
                    value,
                    false, false, this.index, this.currentFileInfo));
            }
            if (indexName) {
                newRules.push(new Declaration(indexName,
                    new Dimension(i + 1),
                    false, false, this.index, this.currentFileInfo));
            }
            if (keyName) {
                newRules.push(new Declaration(keyName,
                    key,
                    false, false, this.index, this.currentFileInfo));
            }
        
            rules.push(new Ruleset([ new(Selector)([ new Element("", '&') ]) ],
                newRules,
                rs.strictImports,
                rs.visibilityInfo()
            ));
        }

        return new Ruleset([ new(Selector)([ new Element("", '&') ]) ],
                rules,
                rs.strictImports,
                rs.visibilityInfo()
            ).eval(this.context);

    }
});
