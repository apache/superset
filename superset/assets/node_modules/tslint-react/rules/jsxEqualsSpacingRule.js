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
var utils_1 = require("../utils");
var OPTION_ALWAYS = "always";
var OPTION_NEVER = "never";
var SPACING_OPTIONS = [OPTION_ALWAYS, OPTION_NEVER];
var OPTIONS_SCHEMA = {
    enum: SPACING_OPTIONS,
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
        ruleName: "jsx-equals-spacing",
        description: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            Disallow or enforce spaces around equal signs in JSX attributes"], ["\n            Disallow or enforce spaces around equal signs in JSX attributes"]))),
        options: {
            type: "array",
            items: [OPTIONS_SCHEMA],
            minLength: 1,
            maxLength: 1,
        },
        optionExamples: [
            "[true, \"" + OPTION_ALWAYS + "\"]",
            "[true, \"" + OPTION_NEVER + "\"]",
        ],
        optionsDescription: Lint.Utils.dedent(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            One of the following two options must be provided:\n\n            * `\"", "\"` requires JSX attributes to have spaces before and after the equals sign\n            * `\"", "\"` requires JSX attributes to NOT have spaces before and after the equals sign"], ["\n            One of the following two options must be provided:\n\n            * \\`\"", "\"\\` requires JSX attributes to have spaces before and after the equals sign\n            * \\`\"", "\"\\` requires JSX attributes to NOT have spaces before and after the equals sign"])), OPTION_ALWAYS, OPTION_NEVER),
        type: "style",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_REQUIRED_SPACE_BEFORE = "A space is required before '='";
    Rule.FAILURE_REQUIRED_SPACE_AFTER = "A space is required after '='";
    Rule.FAILURE_FORBIDDEN_SPACE_BEFORE = "There should be no space before '='";
    Rule.FAILURE_FORBIDDEN_SPACE_AFTER = "There should be no space after '='";
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isJsxOpeningElement(node) || tsutils_1.isJsxSelfClosingElement(node)) {
            node.attributes.forEachChild(function (attribute) {
                if (tsutils_1.isJsxAttribute(attribute)) {
                    validateJsxAttributeSpacing(attribute);
                }
            });
        }
        return ts.forEachChild(node, cb);
    });
    function validateJsxAttributeSpacing(attribute) {
        if (attribute.initializer === undefined) {
            return;
        }
        var equalToken = tsutils_1.getNextToken(attribute.name);
        if (equalToken === undefined) {
            return;
        }
        var spacedBefore = utils_1.getDeleteFixForSpaceBetweenTokens(attribute.name, equalToken);
        var spacedAfter = utils_1.getDeleteFixForSpaceBetweenTokens(equalToken, attribute.initializer);
        if (ctx.options === OPTION_ALWAYS) {
            if (spacedBefore === undefined) {
                var fix = Lint.Replacement.appendText(equalToken.getFullStart(), " ");
                ctx.addFailureAt(equalToken.getStart(), 1, Rule.FAILURE_REQUIRED_SPACE_BEFORE, fix);
            }
            if (spacedAfter === undefined) {
                var fix = Lint.Replacement.appendText(attribute.initializer.getFullStart(), " ");
                ctx.addFailureAt(equalToken.getEnd(), 1, Rule.FAILURE_REQUIRED_SPACE_AFTER, fix);
            }
        }
        else if (ctx.options === OPTION_NEVER) {
            if (spacedBefore !== undefined) {
                ctx.addFailureAt(equalToken.getStart() - 1, 1, Rule.FAILURE_FORBIDDEN_SPACE_BEFORE, spacedBefore);
            }
            if (spacedAfter !== undefined) {
                ctx.addFailureAt(equalToken.getEnd(), 1, Rule.FAILURE_FORBIDDEN_SPACE_AFTER, spacedAfter);
            }
        }
    }
}
var templateObject_1, templateObject_2;
