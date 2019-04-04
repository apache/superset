"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var path = require("path");
var Lint = require("../index");
var utils_1 = require("../utils");
var Casing;
(function (Casing) {
    Casing["CamelCase"] = "camel-case";
    Casing["PascalCase"] = "pascal-case";
    Casing["KebabCase"] = "kebab-case";
})(Casing || (Casing = {}));
var Rule = /** @class */ (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /* tslint:enable:object-literal-sort-keys */
    Rule.FAILURE_STRING = function (expectedCasing) {
        return "File name must be " + Rule.stylizedNameForCasing(expectedCasing);
    };
    Rule.stylizedNameForCasing = function (casing) {
        switch (casing) {
            case Casing.CamelCase:
                return "camelCase";
            case Casing.PascalCase:
                return "PascalCase";
            case Casing.KebabCase:
                return "kebab-case";
        }
    };
    Rule.isCorrectCasing = function (fileName, casing) {
        switch (casing) {
            case Casing.CamelCase:
                return utils_1.isCamelCased(fileName);
            case Casing.PascalCase:
                return utils_1.isPascalCased(fileName);
            case Casing.KebabCase:
                return utils_1.isKebabCased(fileName);
        }
    };
    Rule.prototype.apply = function (sourceFile) {
        if (this.ruleArguments.length !== 1) {
            return [];
        }
        var casing = this.ruleArguments[0];
        var fileName = path.parse(sourceFile.fileName).name;
        if (!Rule.isCorrectCasing(fileName, casing)) {
            return [new Lint.RuleFailure(sourceFile, 0, 0, Rule.FAILURE_STRING(casing), this.ruleName)];
        }
        return [];
    };
    /* tslint:disable:object-literal-sort-keys */
    Rule.metadata = {
        ruleName: "file-name-casing",
        description: "Enforces a consistent file naming convention",
        rationale: "Helps maintain a consistent style across a file hierarchy",
        optionsDescription: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = tslib_1.__makeTemplateObject(["\n            One of the following arguments must be provided:\n\n            * `", "`: File names must be camel-cased: `fileName.ts`.\n            * `", "`: File names must be Pascal-cased: `FileName.ts`.\n            * `", "`: File names must be kebab-cased: `file-name.ts`."], ["\n            One of the following arguments must be provided:\n\n            * \\`", "\\`: File names must be camel-cased: \\`fileName.ts\\`.\n            * \\`", "\\`: File names must be Pascal-cased: \\`FileName.ts\\`.\n            * \\`", "\\`: File names must be kebab-cased: \\`file-name.ts\\`."])), Casing.CamelCase, Casing.PascalCase, Casing.KebabCase),
        options: {
            type: "array",
            items: [
                {
                    type: "string",
                    enum: [Casing.CamelCase, Casing.PascalCase, Casing.KebabCase],
                },
            ],
        },
        optionExamples: [
            [true, Casing.CamelCase],
            [true, Casing.PascalCase],
            [true, Casing.KebabCase],
        ],
        hasFix: false,
        type: "style",
        typescriptOnly: false,
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
var templateObject_1;
