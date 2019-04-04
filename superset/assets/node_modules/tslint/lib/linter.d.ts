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
import * as ts from "typescript";
import { findConfiguration, findConfigurationPath, getRulesDirectories, IConfigurationFile, loadConfigurationFromPath } from "./configuration";
import { ILinterOptions, LintResult } from "./index";
import { RuleFailure } from "./language/rule/rule";
/**
 * Linter that can lint multiple files in consecutive runs.
 */
export declare class Linter {
    private readonly options;
    private program?;
    static VERSION: string;
    static findConfiguration: typeof findConfiguration;
    static findConfigurationPath: typeof findConfigurationPath;
    static getRulesDirectories: typeof getRulesDirectories;
    static loadConfigurationFromPath: typeof loadConfigurationFromPath;
    private failures;
    private fixes;
    /**
     * Creates a TypeScript program object from a tsconfig.json file path and optional project directory.
     */
    static createProgram(configFile: string, projectDirectory?: string): ts.Program;
    /**
     * Returns a list of source file names from a TypeScript program. This includes all referenced
     * files and excludes declaration (".d.ts") files.
     */
    static getFileNames(program: ts.Program): string[];
    constructor(options: ILinterOptions, program?: ts.Program | undefined);
    lint(fileName: string, source: string, configuration?: IConfigurationFile): void;
    getResult(): LintResult;
    private getAllFailures;
    private applyAllFixes;
    protected applyFixes(sourceFilePath: string, source: string, fixableFailures: RuleFailure[]): string;
    private updateProgram;
    private applyRule;
    private getEnabledRules;
    private getSourceFile;
}
