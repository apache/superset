function getTrace(node) {
    function hasMatch(matchNode) {
        if (matchNode.type === 'ASTNode') {
            if (matchNode.node === node) {
                result = [];
                return true;
            }

            if (matchNode.childrenMatch) {
                // use for-loop for better perfomance
                for (var i = 0; i < matchNode.childrenMatch.length; i++) {
                    if (hasMatch(matchNode.childrenMatch[i])) {
                        return true;
                    }
                }
            }
        } else {
            // use for-loop for better perfomance
            for (var i = 0; i < matchNode.match.length; i++) {
                if (hasMatch(matchNode.match[i])) {
                    if (matchNode.syntax.type === 'Type' ||
                        matchNode.syntax.type === 'Property' ||
                        matchNode.syntax.type === 'Keyword') {
                        result.unshift(matchNode.syntax);
                    }
                    return true;
                }
            }
        }

        return false;
    }

    var result = null;

    if (this.matched !== null) {
        hasMatch(this.matched);
    }

    return result;
}

function testNode(match, node, fn) {
    var trace = getTrace.call(match, node);

    if (trace === null) {
        return false;
    }

    return trace.some(fn);
}

function isType(node, type) {
    return testNode(this, node, function(matchNode) {
        return matchNode.type === 'Type' && matchNode.name === type;
    });
}

function isProperty(node, property) {
    return testNode(this, node, function(matchNode) {
        return matchNode.type === 'Property' && matchNode.name === property;
    });
}

function isKeyword(node) {
    return testNode(this, node, function(matchNode) {
        return matchNode.type === 'Keyword';
    });
}

module.exports = {
    getTrace: getTrace,
    isType: isType,
    isProperty: isProperty,
    isKeyword: isKeyword
};
