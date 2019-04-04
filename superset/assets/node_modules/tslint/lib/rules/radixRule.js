"use strict";
/**
 * @license
 * Copyright 2013 Palantir Technologies, Inc.
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
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var tsutils_1 = require("tsutils");
var ts = require("typescript");
var Lint = require("../index");
var Rule = /** @class */ (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "radix",
        description: "Requires the radix parameter to be specified when calling `parseInt`.",
        rationale: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = tslib_1.__makeTemplateObject(["\n            From [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt):\n            > Always specify this parameter to eliminate reader confusion and to guarantee predictable behavior.\n            > Different implementations produce different results when a radix is not specified, usually defaulting the value to 10."], ["\n            From [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt):\n            > Always specify this parameter to eliminate reader confusion and to guarantee predictable behavior.\n            > Different implementations produce different results when a radix is not specified, usually defaulting the value to 10."]))),
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: [true],
        type: "functionality",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_STRING = "Missing radix parameter";
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function isParseInt(expression) {
    return tsutils_1.isIdentifier(expression) && expression.text === "parseInt";
}
function isPropertyAccessParseInt(expression) {
    return tsutils_1.isPropertyAccessExpression(expression) && expression.name.text === "parseInt";
}
function isPropertyAccessOfIdentifier(expression, identifers) {
    return tsutils_1.isPropertyAccessExpression(expression) && tsutils_1.isIdentifier(expression.expression) &&
        identifers.some(function (identifer) { return expression.expression.text === identifer; });
}
function isPropertyAccessOfProperty(expression, identifers) {
    return tsutils_1.isPropertyAccessExpression(expression) && tsutils_1.isPropertyAccessExpression(expression.expression) &&
        identifers.some(function (identifer) { return expression.expression.name.text === identifer; });
}
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isCallExpression(node) && node.arguments.length === 1 &&
            (
            // parseInt("123")
            isParseInt(node.expression) ||
                // window.parseInt("123") || global.parseInt("123") || Number.parseInt("123")
                isPropertyAccessParseInt(node.expression) &&
                    isPropertyAccessOfIdentifier(node.expression, ["global", "window", "Number"]) ||
                // window.Number.parseInt("123") || global.Number.parseInt("123")
                isPropertyAccessParseInt(node.expression) &&
                    isPropertyAccessOfProperty(node.expression, ["Number"]) &&
                    isPropertyAccessOfIdentifier(node.expression.expression, ["global", "window"]))) {
            ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
        }
        return ts.forEachChild(node, cb);
    });
}
var templateObject_1;
