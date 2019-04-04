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
        var bannedProps = this.ruleArguments.length > 0
            ? new Map(this.ruleArguments.map(function (prop) {
                return [prop[0], prop.length > 1 ? prop[1] : ""];
            }))
            : new Map();
        return this.applyWithFunction(sourceFile, walk, { bannedProps: bannedProps });
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "jsx-ban-props",
        description: "Bans the use of specific props.",
        optionsDescription: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            A list of `['propName', 'optional explanation here']` which bans the prop called 'propName'."], ["\n            A list of \\`['propName', 'optional explanation here']\\` which bans the prop called 'propName'."]))),
        options: {
            type: "list",
            listType: {
                type: "string",
                items: { type: "string" },
                minLength: 1,
                maxLength: 2,
            },
        },
        optionExamples: ["[true, [\"someProp], [\"anotherProp\", \"Optional explanation\"]]"],
        type: "functionality",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_STRING_FACTORY = function (propName, explanation) {
        var explanationSuffix = explanation === undefined || explanation === "" ? "" : " " + explanation;
        return "Use of the prop '" + propName + "' is not allowed." + explanationSuffix;
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isJsxAttribute(node)) {
            return ts.forEachChild(node, visitorInJsxAttribute);
        }
        else {
            return ts.forEachChild(node, cb);
        }
    });
    function visitorInJsxAttribute(node) {
        if (tsutils_1.isIdentifier(node)) {
            var propName = node.text;
            if (ctx.options.bannedProps.has(propName)) {
                var propBanExplanation = ctx.options.bannedProps.get(propName);
                ctx.addFailureAtNode(node, Rule.FAILURE_STRING_FACTORY(propName, propBanExplanation));
            }
        }
    }
}
var templateObject_1;
