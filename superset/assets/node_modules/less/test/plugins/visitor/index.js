(function(exports) {
    var RemoveProperty = function(less) {
        this._visitor = new less.visitors.Visitor(this);
    };

    RemoveProperty.prototype = {
        isReplacing: true,
        run: function (root) {
            return this._visitor.visit(root);
        },
        visitDeclaration: function (ruleNode, visitArgs) {
            if (ruleNode.name != '-some-aribitrary-property') {
                return ruleNode;
            } else {
                return [];
            }
        }
    };

    exports.install = function(less, pluginManager) {
        pluginManager.addVisitor( new RemoveProperty(less));
    };

})(typeof exports === 'undefined' ? this['VisitorPlugin'] = {} : exports);
