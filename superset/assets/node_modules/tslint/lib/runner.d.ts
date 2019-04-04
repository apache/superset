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
export interface Options {
    /**
     * Path to a configuration file.
     */
    config?: string;
    /**
     * Exclude globs from path expansion.
     */
    exclude: string[];
    /**
     * File paths to lint.
     */
    files: string[];
    /**
     * Whether to return status code 0 even if there are lint errors.
     */
    force?: boolean;
    /**
     * Whether to fixes linting errors for select rules. This may overwrite linted files.
     */
    fix?: boolean;
    /**
     * Output format.
     */
    format?: string;
    /**
     * Formatters directory path.
     */
    formattersDirectory?: string;
    /**
     * Whether to generate a tslint.json config file in the current working directory.
     */
    init?: boolean;
    /**
     * Output file path.
     */
    out?: string;
    /**
     * Whether to output absolute paths
     */
    outputAbsolutePaths?: boolean;
    /**
     * tsconfig.json file.
     */
    project?: string;
    /**
     * Rules directory paths.
     */
    rulesDirectory?: string | string[];
    /**
     * Run the tests in the given directories to ensure a (custom) TSLint rule's output matches the expected output.
     * When this property is `true` the `files` property is used to specify the directories from which the tests should be executed.
     */
    test?: boolean;
    /**
     * Whether to enable type checking when linting a project.
     */
    typeCheck?: boolean;
}
export declare const enum Status {
    Ok = 0,
    FatalError = 1,
    LintError = 2
}
export interface Logger {
    log(message: string): void;
    error(message: string): void;
}
export declare function run(options: Options, logger: Logger): Promise<Status>;
