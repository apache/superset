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
        return this.applyWithFunction(sourceFile, walk);
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "jsx-key",
        description: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["Warn if an element that likely requires a key prop \u2014 namely,             one present in an array literal or an arrow function expression."], ["Warn if an element that likely requires a key prop \u2014 namely, \\\n            one present in an array literal or an arrow function expression."]))),
        options: null,
        optionsDescription: "",
        optionExamples: ["true"],
        type: "functionality",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_STRING = 'Missing "key" prop for element.';
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if ((tsutils_1.isJsxElement(node) || tsutils_1.isJsxSelfClosingElement(node))
            && node.parent !== undefined
            && tsutils_1.isArrayLiteralExpression(node.parent)) {
            checkIteratorElement(node, ctx);
        }
        if (tsutils_1.isPropertyAccessExpression(node) && node.name.text === "map") {
            var mapFn = node.parent !== undefined && tsutils_1.isCallExpression(node.parent)
                ? node.parent.arguments[0]
                : undefined;
            if (mapFn !== undefined && (tsutils_1.isArrowFunction(mapFn) || tsutils_1.isFunctionExpression(mapFn))) {
                if (tsutils_1.isJsxElement(mapFn.body) || tsutils_1.isJsxSelfClosingElement(mapFn.body)) {
                    checkIteratorElement(mapFn.body, ctx);
                }
                else if (tsutils_1.isBlock(mapFn.body)) {
                    var returnStatement = getReturnStatement(mapFn.body.statements);
                    if (returnStatement !== undefined && returnStatement.expression !== undefined) {
                        if (tsutils_1.isParenthesizedExpression(returnStatement.expression)) {
                            checkIteratorElement(returnStatement.expression.expression, ctx);
                        }
                        else {
                            checkIteratorElement(returnStatement.expression, ctx);
                        }
                    }
                }
            }
        }
        return ts.forEachChild(node, cb);
    });
}
function checkIteratorElement(node, ctx) {
    if (tsutils_1.isJsxElement(node) && !hasKeyProp(node.openingElement.attributes) &&
        !hasKeyPropSpread(node.openingElement.attributes)) {
        ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
    }
    if (tsutils_1.isJsxSelfClosingElement(node) && !hasKeyProp(node.attributes) && !hasKeyPropSpread(node.attributes)) {
        ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
    }
}
function hasKeyProp(attributes) {
    return attributes.properties
        .map(function (prop) { return tsutils_1.isJsxAttribute(prop) && prop.name.text === "key"; })
        .indexOf(true) !== -1;
}
function hasKeyPropSpread(attributes) {
    return attributes.properties.some(function (prop) { return (tsutils_1.isJsxSpreadAttribute(prop) &&
        tsutils_1.isObjectLiteralExpression(prop.expression) &&
        prop.expression.properties.some(function (expProp) { return (expProp.name !== undefined && tsutils_1.isIdentifier(expProp.name) && expProp.name.text === "key"); })); });
}
function getReturnStatement(body) {
    return body.filter(function (item) { return tsutils_1.isReturnStatement(item); })[0];
}
var templateObject_1;
