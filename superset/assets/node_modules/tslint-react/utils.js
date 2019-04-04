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
Object.defineProperty(exports, "__esModule", { value: true });
var Lint = require("tslint");
var ts = require("typescript");
function isMultilineText(text) {
    return /\n/.test(text);
}
exports.isMultilineText = isMultilineText;
function getDeleteFixForSpaceBetweenTokens(firstNode, secondNode) {
    var parent = firstNode.parent;
    var parentStart = parent.getStart();
    var secondNodeStart = secondNode.getFullStart();
    var firstNodeEnd = firstNode.getStart() + firstNode.getWidth();
    var secondNodeRelativeStart = secondNodeStart - parentStart;
    var firstNodeRelativeEnd = firstNodeEnd - parentStart;
    var parentText = parent.getText();
    var trailingComments = ts.getTrailingCommentRanges(parentText, firstNodeRelativeEnd);
    var leadingComments = ts.getLeadingCommentRanges(parentText, secondNodeRelativeStart);
    // tslint:disable-next-line strict-boolean-expressions
    var comments = (trailingComments || []).concat(leadingComments || []);
    if (secondNode.getStart() - firstNode.getStart() - firstNode.getWidth() > getTotalCharCount(comments)) {
        var replacements = comments.map(function (comment) { return parentText.slice(comment.pos, comment.end); }).join("");
        return new Lint.Replacement(secondNodeStart, secondNode.getStart() - secondNodeStart, replacements);
    }
    else {
        return undefined;
    }
}
exports.getDeleteFixForSpaceBetweenTokens = getDeleteFixForSpaceBetweenTokens;
function getTotalCharCount(comments) {
    return comments
        .map(function (comment) { return comment.end - comment.pos; })
        .reduce(function (l, r) { return l + r; }, 0);
}
