var tree = require('../tree');

var _visitArgs = { visitDeeper: true },
    _hasIndexed = false;

function _noop(node) {
    return node;
}

function indexNodeTypes(parent, ticker) {
    // add .typeIndex to tree node types for lookup table
    var key, child;
    for (key in parent) { 
        /* eslint guard-for-in: 0 */
        child = parent[key];
        switch (typeof child) {
            case 'function':
                // ignore bound functions directly on tree which do not have a prototype
                // or aren't nodes
                if (child.prototype && child.prototype.type) {
                    child.prototype.typeIndex = ticker++;
                }
                break;
            case 'object':
                ticker = indexNodeTypes(child, ticker);
                break;
        
        }
    }
    return ticker;
}

var Visitor = function(implementation) {
    this._implementation = implementation;
    this._visitInCache = {};
    this._visitOutCache = {};

    if (!_hasIndexed) {
        indexNodeTypes(tree, 1);
        _hasIndexed = true;
    }
};

Visitor.prototype = {
    visit: function(node) {
        if (!node) {
            return node;
        }

        var nodeTypeIndex = node.typeIndex;
        if (!nodeTypeIndex) {
            // MixinCall args aren't a node type?
            if (node.value && node.value.typeIndex) {
                this.visit(node.value);
            }
            return node;
        }

        var impl = this._implementation,
            func = this._visitInCache[nodeTypeIndex],
            funcOut = this._visitOutCache[nodeTypeIndex],
            visitArgs = _visitArgs,
            fnName;

        visitArgs.visitDeeper = true;

        if (!func) {
            fnName = 'visit' + node.type;
            func = impl[fnName] || _noop;
            funcOut = impl[fnName + 'Out'] || _noop;
            this._visitInCache[nodeTypeIndex] = func;
            this._visitOutCache[nodeTypeIndex] = funcOut;
        }

        if (func !== _noop) {
            var newNode = func.call(impl, node, visitArgs);
            if (node && impl.isReplacing) {
                node = newNode;
            }
        }

        if (visitArgs.visitDeeper && node && node.accept) {
            node.accept(this);
        }

        if (funcOut != _noop) {
            funcOut.call(impl, node);
        }

        return node;
    },
    visitArray: function(nodes, nonReplacing) {
        if (!nodes) {
            return nodes;
        }

        var cnt = nodes.length, i;

        // Non-replacing
        if (nonReplacing || !this._implementation.isReplacing) {
            for (i = 0; i < cnt; i++) {
                this.visit(nodes[i]);
            }
            return nodes;
        }

        // Replacing
        var out = [];
        for (i = 0; i < cnt; i++) {
            var evald = this.visit(nodes[i]);
            if (evald === undefined) { continue; }
            if (!evald.splice) {
                out.push(evald);
            } else if (evald.length) {
                this.flatten(evald, out);
            }
        }
        return out;
    },
    flatten: function(arr, out) {
        if (!out) {
            out = [];
        }

        var cnt, i, item,
            nestedCnt, j, nestedItem;

        for (i = 0, cnt = arr.length; i < cnt; i++) {
            item = arr[i];
            if (item === undefined) {
                continue;
            }
            if (!item.splice) {
                out.push(item);
                continue;
            }

            for (j = 0, nestedCnt = item.length; j < nestedCnt; j++) {
                nestedItem = item[j];
                if (nestedItem === undefined) {
                    continue;
                }
                if (!nestedItem.splice) {
                    out.push(nestedItem);
                } else if (nestedItem.length) {
                    this.flatten(nestedItem, out);
                }
            }
        }

        return out;
    }
};
module.exports = Visitor;
