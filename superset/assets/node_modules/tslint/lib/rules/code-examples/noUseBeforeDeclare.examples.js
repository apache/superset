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
var Lint = require("../../index");
// tslint:disable: object-literal-sort-keys
exports.codeExamples = [
    {
        description: "Check that referenced variables are declared beforehand (default)",
        config: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = tslib_1.__makeTemplateObject(["\n            \"rules\": { \"no-use-before-declare\": true }\n        "], ["\n            \"rules\": { \"no-use-before-declare\": true }\n        "]))),
        pass: Lint.Utils.dedent(templateObject_2 || (templateObject_2 = tslib_1.__makeTemplateObject(["\n            var hello = 'world';\n            var foo;\n\n            console.log(hello, foo, capitalize(hello));\n            // 'world', undefined, 'WORLD'\n\n            function capitalize(val) {\n                return val.toUpperCase();\n            }\n\n            import { default as foo1 } from \"./lib\";\n            import foo2 from \"./lib\";\n            import _, { map, foldl } from \"./underscore\";\n            import * as foo3 from \"./lib\";\n            import \"./lib\";\n\n            function declaredImports() {\n                console.log(foo1);\n                console.log(foo2);\n                console.log(foo3);\n                map([], (x) => x);\n            }\n        "], ["\n            var hello = 'world';\n            var foo;\n\n            console.log(hello, foo, capitalize(hello));\n            // 'world', undefined, 'WORLD'\n\n            function capitalize(val) {\n                return val.toUpperCase();\n            }\n\n            import { default as foo1 } from \"./lib\";\n            import foo2 from \"./lib\";\n            import _, { map, foldl } from \"./underscore\";\n            import * as foo3 from \"./lib\";\n            import \"./lib\";\n\n            function declaredImports() {\n                console.log(foo1);\n                console.log(foo2);\n                console.log(foo3);\n                map([], (x) => x);\n            }\n        "]))),
        fail: Lint.Utils.dedent(templateObject_3 || (templateObject_3 = tslib_1.__makeTemplateObject(["\n            console.log(hello, foo);\n\n            var hello = 'world';\n            var foo;\n\n            function undeclaredImports() {\n                console.log(foo1);\n                console.log(foo2);\n                console.log(foo3);\n                map([], (x) => x);\n            }\n\n            import { default as foo1 } from \"./lib\";\n            import foo2 from \"./lib\";\n            import _, { map, foldl } from \"./underscore\";\n            import * as foo3 from \"./lib\";\n            import \"./lib\";\n        "], ["\n            console.log(hello, foo);\n\n            var hello = 'world';\n            var foo;\n\n            function undeclaredImports() {\n                console.log(foo1);\n                console.log(foo2);\n                console.log(foo3);\n                map([], (x) => x);\n            }\n\n            import { default as foo1 } from \"./lib\";\n            import foo2 from \"./lib\";\n            import _, { map, foldl } from \"./underscore\";\n            import * as foo3 from \"./lib\";\n            import \"./lib\";\n        "]))),
    },
];
var templateObject_1, templateObject_2, templateObject_3;
