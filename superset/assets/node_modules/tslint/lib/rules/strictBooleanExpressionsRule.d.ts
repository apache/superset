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
import * as ts from "typescript";
import * as Lint from "../index";
export declare class Rule extends Lint.Rules.TypedRule {
    static metadata: Lint.IRuleMetadata;
    applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[];
}
export declare type Location = ts.PrefixUnaryExpression | ts.IfStatement | ts.WhileStatement | ts.DoStatement | ts.ForStatement | ts.ConditionalExpression | ts.BinaryExpression;
export declare const enum TypeFailure {
    AlwaysTruthy = 0,
    AlwaysFalsy = 1,
    String = 2,
    Number = 3,
    Null = 4,
    Undefined = 5,
    Enum = 6,
    Mixes = 7
}
declare module "typescript" {
    interface IntrinsicType extends ts.Type {
        intrinsicName: string;
    }
}
