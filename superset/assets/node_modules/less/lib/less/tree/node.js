var Node = function() {
    this.parent = null;
    this.visibilityBlocks = undefined;
    this.nodeVisible = undefined;
    this.rootNode = null;
    this.parsed = null;

    var self = this;
    Object.defineProperty(this, 'currentFileInfo', {
        get: function() { return self.fileInfo(); }
    });
    Object.defineProperty(this, 'index', {
        get: function() { return self.getIndex(); }
    });

};
Node.prototype.setParent = function(nodes, parent) {
    function set(node) {
        if (node && node instanceof Node) {
            node.parent = parent;
        }
    }
    if (Array.isArray(nodes)) {
        nodes.forEach(set);
    }
    else {
        set(nodes);
    }
};
Node.prototype.getIndex = function() {
    return this._index || (this.parent && this.parent.getIndex()) || 0;
};
Node.prototype.fileInfo = function() {
    return this._fileInfo || (this.parent && this.parent.fileInfo()) || {};
};
Node.prototype.isRulesetLike = function() { return false; };
Node.prototype.toCSS = function (context) {
    var strs = [];
    this.genCSS(context, {
        add: function(chunk, fileInfo, index) {
            strs.push(chunk);
        },
        isEmpty: function () {
            return strs.length === 0;
        }
    });
    return strs.join('');
};
Node.prototype.genCSS = function (context, output) {
    output.add(this.value);
};
Node.prototype.accept = function (visitor) {
    this.value = visitor.visit(this.value);
};
Node.prototype.eval = function () { return this; };
Node.prototype._operate = function (context, op, a, b) {
    switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
    }
};
Node.prototype.fround = function(context, value) {
    var precision = context && context.numPrecision;
    // add "epsilon" to ensure numbers like 1.000000005 (represented as 1.000000004999...) are properly rounded:
    return (precision) ? Number((value + 2e-16).toFixed(precision)) : value;
};
Node.compare = function (a, b) {
    /* returns:
     -1: a < b
     0: a = b
     1: a > b
     and *any* other value for a != b (e.g. undefined, NaN, -2 etc.) */

    if ((a.compare) &&
        // for "symmetric results" force toCSS-based comparison
        // of Quoted or Anonymous if either value is one of those
        !(b.type === 'Quoted' || b.type === 'Anonymous')) {
        return a.compare(b);
    } else if (b.compare) {
        return -b.compare(a);
    } else if (a.type !== b.type) {
        return undefined;
    }

    a = a.value;
    b = b.value;
    if (!Array.isArray(a)) {
        return a === b ? 0 : undefined;
    }
    if (a.length !== b.length) {
        return undefined;
    }
    for (var i = 0; i < a.length; i++) {
        if (Node.compare(a[i], b[i]) !== 0) {
            return undefined;
        }
    }
    return 0;
};

Node.numericCompare = function (a, b) {
    return a  <  b ? -1
        : a === b ?  0
        : a  >  b ?  1 : undefined;
};
// Returns true if this node represents root of ast imported by reference
Node.prototype.blocksVisibility = function () {
    if (this.visibilityBlocks == null) {
        this.visibilityBlocks = 0;
    }
    return this.visibilityBlocks !== 0;
};
Node.prototype.addVisibilityBlock = function () {
    if (this.visibilityBlocks == null) {
        this.visibilityBlocks = 0;
    }
    this.visibilityBlocks = this.visibilityBlocks + 1;
};
Node.prototype.removeVisibilityBlock = function () {
    if (this.visibilityBlocks == null) {
        this.visibilityBlocks = 0;
    }
    this.visibilityBlocks = this.visibilityBlocks - 1;
};
// Turns on node visibility - if called node will be shown in output regardless
// of whether it comes from import by reference or not
Node.prototype.ensureVisibility = function () {
    this.nodeVisible = true;
};
// Turns off node visibility - if called node will NOT be shown in output regardless
// of whether it comes from import by reference or not
Node.prototype.ensureInvisibility = function () {
    this.nodeVisible = false;
};
// return values:
// false - the node must not be visible
// true - the node must be visible
// undefined or null - the node has the same visibility as its parent
Node.prototype.isVisible = function () {
    return this.nodeVisible;
};
Node.prototype.visibilityInfo = function() {
    return {
        visibilityBlocks: this.visibilityBlocks,
        nodeVisible: this.nodeVisible
    };
};
Node.prototype.copyVisibilityInfo = function(info) {
    if (!info) {
        return;
    }
    this.visibilityBlocks = info.visibilityBlocks;
    this.nodeVisible = info.nodeVisible;
};
module.exports = Node;
