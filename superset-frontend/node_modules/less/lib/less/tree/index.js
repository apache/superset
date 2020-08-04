var tree = Object.create(null);

tree.Node = require('./node');
tree.Color = require('./color');
tree.AtRule = require('./atrule');
tree.DetachedRuleset = require('./detached-ruleset');
tree.Operation = require('./operation');
tree.Dimension = require('./dimension');
tree.Unit = require('./unit');
tree.Keyword = require('./keyword');
tree.Variable = require('./variable');
tree.Property = require('./property');
tree.Ruleset = require('./ruleset');
tree.Element = require('./element');
tree.Attribute = require('./attribute');
tree.Combinator = require('./combinator');
tree.Selector = require('./selector');
tree.Quoted = require('./quoted');
tree.Expression = require('./expression');
tree.Declaration = require('./declaration');
tree.Call = require('./call');
tree.URL = require('./url');
tree.Import = require('./import');
tree.mixin = {
    Call: require('./mixin-call'),
    Definition: require('./mixin-definition')
};
tree.Comment = require('./comment');
tree.Anonymous = require('./anonymous');
tree.Value = require('./value');
tree.JavaScript = require('./javascript');
tree.Assignment = require('./assignment');
tree.Condition = require('./condition');
tree.Paren = require('./paren');
tree.Media = require('./media');
tree.UnicodeDescriptor = require('./unicode-descriptor');
tree.Negative = require('./negative');
tree.Extend = require('./extend');
tree.VariableCall = require('./variable-call');
tree.NamespaceValue = require('./namespace-value');

module.exports = tree;
