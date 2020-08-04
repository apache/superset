"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const util_1 = require("./util");
function convertAst(sourceFile) {
    const wrapped = {
        node: sourceFile,
        parent: undefined,
        kind: ts.SyntaxKind.SourceFile,
        children: [],
        next: undefined,
        skip: undefined,
    };
    const flat = [];
    let current = wrapped;
    let previous = current;
    ts.forEachChild(sourceFile, function wrap(node) {
        flat.push(node);
        const parent = current;
        previous.next = current = {
            node,
            parent,
            kind: node.kind,
            children: [],
            next: undefined,
            skip: undefined,
        };
        if (previous !== parent)
            setSkip(previous, current);
        previous = current;
        parent.children.push(current);
        if (util_1.isNodeKind(node.kind))
            ts.forEachChild(node, wrap);
        current = parent;
    });
    return {
        wrapped,
        flat,
    };
}
exports.convertAst = convertAst;
function setSkip(node, skip) {
    do {
        node.skip = skip;
        node = node.parent;
    } while (node !== skip.parent);
}
