"use strict";
/**
 * @license
 * Copyright 2016 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
var ts = require("typescript");
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithWalker(new JsxWrapMultilineWalker(sourceFile, this.ruleName, undefined));
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "jsx-wrap-multiline",
        description: "Checks that multiline JSX elements are wrapped in parens",
        options: null,
        optionsDescription: "",
        optionExamples: ["true"],
        type: "style",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_NOT_WRAPPED = "Multiline JSX elements must be wrapped in parentheses";
    Rule.FAILURE_MISSING_NEW_LINE_AFTER_OPEN = "New line required after open parenthesis when wrapping multiline JSX elements";
    Rule.FAILURE_MISSING_NEW_LINE_BEFORE_CLOSE = "New line required before close parenthesis when wrapping multiline JSX elements";
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
var JsxWrapMultilineWalker = /** @class */ (function (_super) {
    __extends(JsxWrapMultilineWalker, _super);
    function JsxWrapMultilineWalker() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    JsxWrapMultilineWalker.prototype.walk = function (sourceFile) {
        var _this = this;
        var cb = function (node) {
            if (tsutils_1.isJsxElement(node) || tsutils_1.isJsxSelfClosingElement(node) || tsutils_1.isJsxFragment(node)) {
                _this.checkNode(node, sourceFile);
            }
            else {
                return ts.forEachChild(node, cb);
            }
        };
        return ts.forEachChild(sourceFile, cb);
    };
    JsxWrapMultilineWalker.prototype.checkNode = function (node, sourceFile) {
        var startLine = this.getLine(node.getStart(this.sourceFile));
        var endLine = this.getLine(node.getEnd());
        if (startLine === endLine) {
            return;
        }
        if (node.parent == null) {
            this.addFailureAtNode(node, Rule.FAILURE_NOT_WRAPPED);
            return;
        }
        if (tsutils_1.isJsxElement(node.parent) || tsutils_1.isJsxFragment(node.parent)) {
            return;
        }
        var scanner = this.getScanner(sourceFile);
        scanner.setTextPos(node.getFullStart() - 1);
        var prevTokenKind = scanner.scan();
        var siblings = node.parent.getChildren(sourceFile);
        var index = siblings.indexOf(node);
        var previousToken = siblings[index - 1];
        var nextToken = siblings[index + 1];
        if (prevTokenKind === ts.SyntaxKind.OpenParenToken && node.getFullText().match(/^[\r\n]+/) !== null) {
            return;
        }
        if (nextToken == null || nextToken.kind !== ts.SyntaxKind.CloseParenToken) {
            this.addFailureAtNode(node, Rule.FAILURE_NOT_WRAPPED);
            return;
        }
        var startParenLine = this.getLine(previousToken.getStart(sourceFile));
        if (startParenLine === startLine) {
            this.addFailureAtNode(previousToken, Rule.FAILURE_MISSING_NEW_LINE_AFTER_OPEN);
        }
        var endParenLine = this.getLine(nextToken.getStart(sourceFile));
        if (endParenLine === endLine) {
            this.addFailureAtNode(nextToken, Rule.FAILURE_MISSING_NEW_LINE_BEFORE_CLOSE);
        }
    };
    JsxWrapMultilineWalker.prototype.getScanner = function (sourceFile) {
        if (this.scanner === undefined) {
            this.scanner = ts.createScanner(ts.ScriptTarget.ES5, false, ts.LanguageVariant.Standard, sourceFile.text);
        }
        return this.scanner;
    };
    JsxWrapMultilineWalker.prototype.getLine = function (position) {
        return this.getSourceFile().getLineAndCharacterOfPosition(position).line;
    };
    return JsxWrapMultilineWalker;
}(Lint.AbstractWalker));
