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
var htmlEntityRegex = /(&(?:#[0-9]+|[a-zA-Z]+);)/;
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk, {
            allowHtmlEntities: this.ruleArguments.indexOf("allow-htmlentities") !== -1,
            allowPunctuation: this.ruleArguments.indexOf("allow-punctuation") !== -1,
        });
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "jsx-use-translation-function",
        description: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            Enforces use of a translation function. Most plain string literals are disallowed in JSX when enabled."], ["\n            Enforces use of a translation function. Most plain string literals are disallowed in JSX when enabled."]))),
        options: {
            type: "array",
            items: {
                type: "string",
                enum: ["allow-punctuation", "allow-htmlentities"],
            },
        },
        optionsDescription: Lint.Utils.dedent(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            Whether to allow punctuation and or HTML entities"], ["\n            Whether to allow punctuation and or HTML entities"]))),
        type: "functionality",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */
    Rule.TRANSLATABLE_ATTRIBUTES = new Set(["placeholder", "title", "alt"]);
    Rule.FAILURE_STRING = "String literals are disallowed as JSX. Use a translation function";
    Rule.FAILURE_STRING_FACTORY = function (text) {
        return "String literal is not allowed for value of " + text + ". Use a translation function";
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isJsxElement(node)) {
            for (var _i = 0, _a = node.children; _i < _a.length; _i++) {
                var child = _a[_i];
                if (tsutils_1.isJsxText(child) && isInvalidText(child.getText(), ctx.options)) {
                    ctx.addFailureAtNode(child, Rule.FAILURE_STRING);
                }
                if (tsutils_1.isJsxExpression(child)
                    && child.expression !== undefined
                    && tsutils_1.isTextualLiteral(child.expression)) {
                    if (isInvalidText(child.expression.text, ctx.options)) {
                        ctx.addFailureAtNode(child, Rule.FAILURE_STRING);
                    }
                }
            }
        }
        else if (tsutils_1.isJsxAttribute(node)) {
            if (Rule.TRANSLATABLE_ATTRIBUTES.has(node.name.text) && node.initializer !== undefined) {
                if (tsutils_1.isTextualLiteral(node.initializer) && isInvalidText(node.initializer.text, ctx.options)) {
                    ctx.addFailureAtNode(node.initializer, Rule.FAILURE_STRING_FACTORY(node.name.text));
                }
                if (tsutils_1.isJsxExpression(node.initializer) && tsutils_1.isTextualLiteral(node.initializer.expression)) {
                    if (isInvalidText(node.initializer.expression.text, ctx.options)) {
                        ctx.addFailureAtNode(node.initializer, Rule.FAILURE_STRING_FACTORY(node.name.text));
                    }
                }
            }
        }
        return ts.forEachChild(node, cb);
    });
}
function isInvalidText(text, options) {
    var t = text.trim();
    if (t === "") {
        return false;
    }
    if (options.allowPunctuation && t.indexOf("&") === -1) {
        // fast path: any punctuation that is not potentially an HTML entity
        return /\w/.test(t);
    }
    // split the text into HTML entities and everything else so we can test each part of the string individually
    var parts = t.split(htmlEntityRegex).filter(function (entity) { return entity !== ""; });
    return parts.some(function (entity) {
        if (options.allowHtmlEntities && htmlEntityRegex.test(entity)) {
            return false;
        }
        if (options.allowPunctuation) {
            return /\w/.test(entity);
        }
        return true;
    });
}
var templateObject_1, templateObject_2;
