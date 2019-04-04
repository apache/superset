"use strict";
/**
 * @license
 * Copyright 2017 Palantir Technologies, Inc.
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
var OPTION_ALWAYS = "always";
var OPTION_NEVER = "never";
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
        ruleName: "jsx-boolean-value",
        description: "Enforce boolean attribute notation in jsx.",
        optionsDescription: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            One of the following two options must be provided:\n            * `\"", "\"` requires JSX boolean values to always be set.\n            * `\"", "\"` prevents JSX boolean values to be explicity set as `true`"], ["\n            One of the following two options must be provided:\n            * \\`\"", "\"\\` requires JSX boolean values to always be set.\n            * \\`\"", "\"\\` prevents JSX boolean values to be explicity set as \\`true\\`"])), OPTION_ALWAYS, OPTION_NEVER),
        options: {
            type: "array",
            items: [{
                    enum: [OPTION_ALWAYS, OPTION_NEVER],
                    type: "string",
                }],
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
    Rule.NEVER_MESSAGE = "Value must be omitted for boolean attributes";
    Rule.ALWAYS_MESSAGE = "Value must be set for boolean attributes";
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isJsxAttribute(node)) {
            var initializer = node.initializer;
            if (initializer === undefined) {
                // if no option set, or explicitly set to "always"
                if (ctx.options === undefined || ctx.options === OPTION_ALWAYS) {
                    var text = node.name.text;
                    var width = text.length;
                    var start = node.end - width;
                    var fix = Lint.Replacement.replaceFromTo(start, node.end, text + "={true}");
                    ctx.addFailureAt(start, width, Rule.ALWAYS_MESSAGE, fix);
                }
            }
            else if (initializer.kind === ts.SyntaxKind.JsxExpression) {
                var isValueTrue = initializer.expression !== undefined
                    && initializer.expression.kind === ts.SyntaxKind.TrueKeyword;
                if (isValueTrue && ctx.options === OPTION_NEVER) {
                    var width = node.getWidth(ctx.sourceFile);
                    var start = node.end - width;
                    var fix = Lint.Replacement.replaceFromTo(start, node.end, node.getFirstToken(ctx.sourceFile).getText(ctx.sourceFile));
                    ctx.addFailureAt(start, width, Rule.NEVER_MESSAGE, fix);
                }
            }
        }
        return ts.forEachChild(node, cb);
    });
}
var templateObject_1;
