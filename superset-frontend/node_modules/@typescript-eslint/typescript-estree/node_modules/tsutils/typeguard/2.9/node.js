"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
tslib_1.__exportStar(require("../2.8/node"), exports);
const ts = require("typescript");
function isImportTypeNode(node) {
    return node.kind === ts.SyntaxKind.ImportType;
}
exports.isImportTypeNode = isImportTypeNode;
