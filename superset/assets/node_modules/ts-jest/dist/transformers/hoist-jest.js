"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var bs_logger_1 = require("bs-logger");
var HOIST_METHODS = ['mock', 'unmock'];
exports.name = 'hoisting-jest-mock';
exports.version = 1;
function factory(cs) {
    var logger = cs.logger.child({ namespace: 'ts-hoisting' });
    var ts = cs.compilerModule;
    function shouldHoistNode(node) {
        return (ts.isExpressionStatement(node) &&
            ts.isCallExpression(node.expression) &&
            ts.isPropertyAccessExpression(node.expression.expression) &&
            ts.isIdentifier(node.expression.expression.expression) &&
            node.expression.expression.expression.text === 'jest' &&
            ts.isIdentifier(node.expression.expression.name) &&
            HOIST_METHODS.includes(node.expression.expression.name.text));
    }
    function createVisitor(ctx, _) {
        var level = 0;
        var hoisted = [];
        var enter = function () {
            level++;
            if (hoisted[level]) {
                hoisted[level].splice(0, hoisted[level].length);
            }
        };
        var exit = function () { return level--; };
        var hoist = function (node) {
            if (hoisted[level]) {
                hoisted[level].push(node);
            }
            else {
                hoisted[level] = [node];
            }
        };
        var visitor = function (node) {
            enter();
            var resultNode = ts.visitEachChild(node, visitor, ctx);
            if (hoisted[level] && hoisted[level].length) {
                var hoistedStmts_1 = hoisted[level];
                var otherStmts = resultNode.statements.filter(function (s) { return !hoistedStmts_1.includes(s); });
                var newNode = ts.getMutableClone(resultNode);
                newNode.statements = ts.createNodeArray(__spread(hoistedStmts_1, otherStmts));
                resultNode = newNode;
            }
            exit();
            if (shouldHoistNode(resultNode)) {
                hoist(resultNode);
            }
            return resultNode;
        };
        return visitor;
    }
    return function (ctx) {
        var _a;
        return logger.wrap((_a = {}, _a[bs_logger_1.LogContexts.logLevel] = bs_logger_1.LogLevels.debug, _a.call = null, _a), 'visitSourceFileNode(): hoisting', function (sf) { return ts.visitNode(sf, createVisitor(ctx, sf)); });
    };
}
exports.factory = factory;
