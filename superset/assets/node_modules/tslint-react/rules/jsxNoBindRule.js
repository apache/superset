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
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        // This creates a WalkContext<T> and passes it in as an argument.
        // An optional 3rd parameter allows you to pass in a parsed version
        // of this.ruleArguments. If used, it is preferred to parse it into
        // a more useful object than this.getOptions().
        return this.applyWithFunction(sourceFile, walk);
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "jsx-no-bind",
        description: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["Forbids function binding in JSX attributes. This has the same intent             as jsx-no-lambda in helping you avoid excessive re-renders."], ["Forbids function binding in JSX attributes. This has the same intent \\\n            as jsx-no-lambda in helping you avoid excessive re-renders."]))),
        descriptionDetails: Lint.Utils.dedent(templateObject_2 || (templateObject_2 = __makeTemplateObject(["Note that this currently only does a simple syntactic check,             not a semantic one (it doesn't use the type checker). So it may             have some rare false positives if you define your own .bind function             and supply this as a parameter."], ["Note that this currently only does a simple syntactic check, \\\n            not a semantic one (it doesn't use the type checker). So it may \\\n            have some rare false positives if you define your own .bind function \\\n            and supply this as a parameter."]))),
        options: null,
        optionsDescription: "",
        optionExamples: ["true"],
        type: "functionality",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_STRING = "Binds are forbidden in JSX attributes due to their rendering performance impact";
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (!tsutils_1.isJsxAttribute(node)) {
            return ts.forEachChild(node, cb);
        }
        var initializer = node.initializer;
        if (initializer === undefined || !tsutils_1.isJsxExpression(initializer)) {
            return;
        }
        var expression = initializer.expression;
        if (expression === undefined
            || !tsutils_1.isCallExpression(expression)
            || !expression.getText(ctx.sourceFile).includes(".bind(this)")) {
            return;
        }
        return ctx.addFailureAtNode(expression, Rule.FAILURE_STRING);
    });
}
var templateObject_1, templateObject_2;
