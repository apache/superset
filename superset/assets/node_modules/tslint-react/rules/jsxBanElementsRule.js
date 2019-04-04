"use strict";
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
/**
 * @license
 * Copyright 2018 Palantir Technologies, Inc.
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
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
var ts = require("typescript");
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_STRING_FACTORY = function (elementName, messageAddition) {
        return "JSX element '" + elementName + "' is banned." + (messageAddition !== undefined ? " " + messageAddition : "");
    };
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk, this.ruleArguments.map(parseOption));
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "jsx-ban-elements",
        description: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            Bans specific JSX elements from being used."], ["\n            Bans specific JSX elements from being used."]))),
        options: {
            type: "list",
            listType: {
                type: "array",
                items: { type: "string" },
                minLength: 1,
                maxLength: 2,
            },
        },
        optionsDescription: Lint.Utils.dedent(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            A list of `[\"regex\", \"optional explanation here\"]`, which bans\n            types that match `regex`"], ["\n            A list of \\`[\"regex\", \"optional explanation here\"]\\`, which bans\n            types that match \\`regex\\`"]))),
        optionExamples: [[true, ["Object", "Use {} instead."], ["String"]]],
        type: "typescript",
        typescriptOnly: false,
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function parseOption(_a) {
    var pattern = _a[0], message = _a[1];
    return { message: message, pattern: new RegExp("" + pattern) };
}
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isJsxOpeningElement(node) || tsutils_1.isJsxSelfClosingElement(node)) {
            var typeName = node.tagName.getText();
            for (var _i = 0, _a = ctx.options; _i < _a.length; _i++) {
                var ban = _a[_i];
                if (ban.pattern.test(typeName)) {
                    ctx.addFailureAtNode(node.tagName, Rule.FAILURE_STRING_FACTORY(typeName, ban.message));
                    break;
                }
            }
        }
        return ts.forEachChild(node, cb);
    });
}
var templateObject_1, templateObject_2;
