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
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
var ts = require("typescript");
var utils_1 = require("../utils");
var OPTION_ALWAYS = "always";
var OPTION_NEVER = "never";
var SPACING_VALUES = [OPTION_ALWAYS, OPTION_NEVER];
var SPACING_OBJECT = {
    enum: SPACING_VALUES,
    type: "string",
};
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        var option = Array.isArray(this.ruleArguments) ? this.ruleArguments[0] : undefined;
        return this.applyWithFunction(sourceFile, walk, option);
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "jsx-curly-spacing",
        description: "Checks JSX curly braces spacing",
        optionsDescription: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            One of the following two options must be provided:\n\n            * `\"", "\"` requires JSX attributes to have spaces between curly braces\n            * `\"", "\"` requires JSX attributes to NOT have spaces between curly braces"], ["\n            One of the following two options must be provided:\n\n            * \\`\"", "\"\\` requires JSX attributes to have spaces between curly braces\n            * \\`\"", "\"\\` requires JSX attributes to NOT have spaces between curly braces"])), OPTION_ALWAYS, OPTION_NEVER),
        options: {
            type: "array",
            items: [SPACING_OBJECT],
            minLength: 1,
            maxLength: 1,
        },
        optionExamples: [
            "[true, \"" + OPTION_ALWAYS + "\"]",
            "[true, \"" + OPTION_NEVER + "\"]",
        ],
        type: "style",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_NO_ENDING_SPACE = function (token) { return "A space is required before " + token; };
    Rule.FAILURE_NO_BEGINNING_SPACE = function (token) { return "A space is required after " + token; };
    Rule.FAILURE_FORBIDDEN_SPACES_BEGINNING = function (token) { return "There should be no space after " + token; };
    Rule.FAILURE_FORBIDDEN_SPACES_END = function (token) { return "There should be no space before " + token; };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isJsxExpression(node) || tsutils_1.isJsxSpreadAttribute(node)) {
            validateBraceSpacing(node);
        }
        return ts.forEachChild(node, cb);
    });
    function validateBraceSpacing(node) {
        var firstToken = node.getFirstToken();
        var secondToken = node.getChildAt(1);
        var lastToken = node.getLastToken();
        var secondToLastToken = node.getChildAt(node.getChildCount() - 2);
        var nodeStart = node.getStart();
        var nodeWidth = node.getWidth();
        if (ctx.options === OPTION_ALWAYS) {
            var deleteFix = utils_1.getDeleteFixForSpaceBetweenTokens(firstToken, secondToken);
            if (deleteFix === undefined) {
                var fix = Lint.Replacement.appendText(secondToken.getFullStart(), " ");
                var failureString = Rule.FAILURE_NO_BEGINNING_SPACE(firstToken.getText());
                ctx.addFailureAt(nodeStart, 1, failureString, fix);
            }
            deleteFix = utils_1.getDeleteFixForSpaceBetweenTokens(secondToLastToken, lastToken);
            if (deleteFix === undefined) {
                var fix = Lint.Replacement.appendText(lastToken.getStart(), " ");
                var failureString = Rule.FAILURE_NO_ENDING_SPACE(lastToken.getText());
                ctx.addFailureAt(nodeStart + nodeWidth - 1, 1, failureString, fix);
            }
        }
        else if (ctx.options === OPTION_NEVER) {
            var firstAndSecondTokensCombinedText = getTokensCombinedText(firstToken, secondToken);
            var lastAndSecondToLastCombinedText = getTokensCombinedText(secondToLastToken, lastToken);
            if (!utils_1.isMultilineText(firstAndSecondTokensCombinedText)) {
                var fix = utils_1.getDeleteFixForSpaceBetweenTokens(firstToken, secondToken);
                if (fix !== undefined) {
                    var failureString = Rule.FAILURE_FORBIDDEN_SPACES_BEGINNING(firstToken.getText());
                    ctx.addFailureAt(nodeStart, 1, failureString, fix);
                }
            }
            if (!utils_1.isMultilineText(lastAndSecondToLastCombinedText)) {
                var fix = utils_1.getDeleteFixForSpaceBetweenTokens(secondToLastToken, lastToken);
                if (fix !== undefined) {
                    var failureString = Rule.FAILURE_FORBIDDEN_SPACES_END(lastToken.getText());
                    // degenerate case when firstToken is the same as the secondToLastToken as we would
                    // have already queued up a fix in the previous branch, do not apply fix
                    if (firstToken === secondToLastToken) {
                        ctx.addFailureAt(nodeStart + nodeWidth - 1, 1, failureString);
                    }
                    else {
                        ctx.addFailureAt(nodeStart + nodeWidth - 1, 1, failureString, fix);
                    }
                }
            }
        }
    }
}
function getTokensCombinedText(firstToken, nextToken) {
    var parentNodeText = nextToken.parent.getText();
    var firstTokenText = firstToken.getText();
    var secondTokenText = nextToken.getText();
    var secondTokenTextLocation = parentNodeText.indexOf(secondTokenText);
    var firstTokenTextLocation = parentNodeText.indexOf(firstTokenText);
    var combinedTokeText = parentNodeText.slice(firstTokenTextLocation, secondTokenTextLocation + secondTokenText.length);
    return combinedTokeText;
}
var templateObject_1;
