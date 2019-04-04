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
        ruleName: "jsx-no-lambda",
        description: "Checks for fresh lambda literals used in JSX attributes",
        descriptionDetails: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["Creating new anonymous functions (with either the function syntax or             ES2015 arrow syntax) inside the render call stack works against pure component             rendering. When doing an equality check between two lambdas, React will always             consider them unequal values and force the component to re-render more often than necessary."], ["Creating new anonymous functions (with either the function syntax or \\\n            ES2015 arrow syntax) inside the render call stack works against pure component \\\n            rendering. When doing an equality check between two lambdas, React will always \\\n            consider them unequal values and force the component to re-render more often than necessary."]))),
        options: null,
        optionsDescription: "",
        optionExamples: ["true"],
        type: "functionality",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_STRING = "Lambdas are forbidden in JSX attributes due to their rendering performance impact";
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        // continue iterations until JsxAttribute will be found
        if (tsutils_1.isJsxAttribute(node)) {
            var initializer = node.initializer;
            // early exit in case when initializer is string literal or not provided (e.d. `disabled`)
            if (initializer === undefined || !tsutils_1.isJsxExpression(initializer)) {
                return;
            }
            // Ignore "ref" attribute.
            // ref is not part of the props so using lambdas here will not trigger useless re-renders
            if (node.name.text === "ref") {
                return;
            }
            var expression = initializer.expression;
            if (expression !== undefined && isLambda(expression)) {
                return ctx.addFailureAtNode(expression, Rule.FAILURE_STRING);
            }
        }
        return ts.forEachChild(node, cb);
    });
}
function isLambda(node) {
    switch (node.kind) {
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ArrowFunction:
            return true;
        case ts.SyntaxKind.ParenthesizedExpression:
            return isLambda(node.expression);
        default:
            return false;
    }
}
var templateObject_1;
