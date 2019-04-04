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
    // tslint:disable object-literal-sort-keys
    Rule.metadata = {
        ruleName: "jsx-alignment",
        description: "Enforces consistent and readable vertical alignment of JSX tags and attributes",
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: ["true"],
        type: "style",
        typescriptOnly: false,
    };
    // tslint:enable object-literal-sort-keys
    Rule.ATTR_LINE_FAILURE = "JSX attributes must be on a line below the opening tag";
    Rule.ATTR_INDENT_FAILURE = "JSX attributes must be indented further than the opening tag statement";
    Rule.ATTR_ALIGN_FAILURE = "JSX attributes must be on their own line and vertically aligned";
    Rule.TAG_CLOSE_FAILURE = "Tag closing must be on its own line and aligned with opening of tag";
    Rule.CLOSING_TAG_FAILURE = "Closing tag must be on its own line and aligned with opening tag";
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
var LEADING_WHITESPACE_REGEX = /[ \t]/;
function walk(ctx) {
    return ts.forEachChild(ctx.sourceFile, function cb(node) {
        if (tsutils_1.isJsxElement(node)) {
            if (isMultiline(node.openingElement)) {
                var startLocation = getLineAndCharacter(node);
                var closeLocation = ctx.sourceFile.getLineAndCharacterOfPosition(node.openingElement.getEnd() - ">".length);
                checkElement(startLocation, node.openingElement.attributes, closeLocation, node.closingElement);
            }
        }
        else if (tsutils_1.isJsxSelfClosingElement(node)) {
            if (isMultiline(node)) {
                var startLocation = getLineAndCharacter(node);
                var closeLocation = ctx.sourceFile.getLineAndCharacterOfPosition(node.getEnd() - "/>".length);
                checkElement(startLocation, node.attributes, closeLocation);
            }
        }
        return ts.forEachChild(node, cb);
    });
    function checkElement(elementOpen, attributes, // TS 2.6
        elementClose, closingTag) {
        var attrs = Array.isArray(attributes) ? attributes : attributes.properties;
        if (attrs.length === 0) {
            return;
        }
        // in a line like "const element = <Foo",
        // we want the initial indent to be the start of "const" instead of the start of "<Foo"
        var initialIndent = getFirstNonWhitespaceCharacter(elementOpen.line);
        var firstAttr = attrs[0];
        var firstAttrCharacter = getCharacter(firstAttr);
        // ensure that first attribute is not on the same line as the start of the tag
        if (getLine(firstAttr) === elementOpen.line) {
            reportFailure(firstAttr, Rule.ATTR_LINE_FAILURE);
        }
        var lastSeenLine = -1;
        for (var _i = 0, attrs_1 = attrs; _i < attrs_1.length; _i++) {
            var attr = attrs_1[_i];
            var character = getCharacter(attr);
            // ensure each attribute is indented further than the start of the tag
            if (character <= initialIndent) {
                reportFailure(attr, Rule.ATTR_INDENT_FAILURE);
            }
            // ensure each attribute is indented equally
            if (attr !== firstAttr && character !== firstAttrCharacter) {
                reportFailure(attr, Rule.ATTR_ALIGN_FAILURE);
            }
            lastSeenLine = getLine(attr);
        }
        // ensure that the closing token of the tag with attributes is on its own line
        // and that it is indented the same as the opening
        if (lastSeenLine === elementClose.line || elementClose.character !== initialIndent) {
            var start = ctx.sourceFile.getPositionOfLineAndCharacter(elementClose.line, elementClose.character);
            ctx.addFailureAt(start, 1, Rule.TAG_CLOSE_FAILURE);
        }
        // ensure closing tag is on its own line and aligned with the opening tag
        if (closingTag !== undefined) {
            var closingTagLocation = getLineAndCharacter(closingTag);
            if (closingTagLocation.line <= elementClose.line || closingTagLocation.character !== initialIndent) {
                reportFailure(closingTag, Rule.CLOSING_TAG_FAILURE);
            }
        }
    }
    function getFirstNonWhitespaceCharacter(line) {
        var lineStart = ctx.sourceFile.getLineStarts()[line];
        var source = ctx.sourceFile.getFullText();
        var width = 0;
        while (lineStart + width < source.length && LEADING_WHITESPACE_REGEX.test(source.charAt(lineStart + width))) {
            width++;
        }
        return width;
    }
    function isMultiline(node) {
        var startLine = getLine(node);
        var endLine = ctx.sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        return startLine !== endLine;
    }
    function getLineAndCharacter(node) {
        return ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart(ctx.sourceFile));
    }
    function getCharacter(node) {
        return getLineAndCharacter(node).character;
    }
    function getLine(node) {
        return getLineAndCharacter(node).line;
    }
    function reportFailure(node, message) {
        ctx.addFailureAt(node.getStart(), node.getWidth(), message);
    }
}
