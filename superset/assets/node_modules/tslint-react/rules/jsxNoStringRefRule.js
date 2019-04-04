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
        return this.applyWithFunction(sourceFile, walk);
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "jsx-no-string-ref",
        description: "Checks for string literal refs",
        descriptionDetails: "This syntax is deprecated and will be removed in a future version of React",
        options: null,
        optionsDescription: "",
        optionExamples: ["true"],
        type: "style",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_STRING = "Pass a callback to ref prop instead of a string literal";
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isJsxAttribute(node)) {
            var name = node.name, initializer = node.initializer;
            var isRefAttribute = name.text === "ref";
            if (isRefAttribute && initializer !== undefined) {
                var hasStringInitializer = initializer.kind === ts.SyntaxKind.StringLiteral;
                var hasStringExpressionInitializer = tsutils_1.isJsxExpression(initializer)
                    && initializer.expression !== undefined
                    && (tsutils_1.isStringLiteral(initializer.expression) || tsutils_1.isTemplateExpression(initializer.expression));
                if (hasStringInitializer || hasStringExpressionInitializer) {
                    ctx.addFailureAtNode(initializer, Rule.FAILURE_STRING);
                }
            }
        }
        return ts.forEachChild(node, cb);
    });
}
