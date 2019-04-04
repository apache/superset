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
import { Logger } from "./runner";
import { LintError } from "./verify/lintError";
export interface TestOutput {
    skipped: false;
    errorsFromLinter: LintError[];
    errorsFromMarkup: LintError[];
    fixesFromLinter: string;
    fixesFromMarkup: string;
    markupFromLinter: string;
    markupFromMarkup: string;
}
export interface SkippedTest {
    skipped: true;
    requirement: string;
}
export interface TestResult {
    directory: string;
    results: {
        [fileName: string]: TestOutput | SkippedTest;
    };
}
export declare function runTests(patterns: string[], rulesDirectory?: string | string[]): TestResult[];
export declare function runTest(testDirectory: string, rulesDirectory?: string | string[]): TestResult;
export declare function consoleTestResultsHandler(testResults: TestResult[], logger: Logger): boolean;
export declare function consoleTestResultHandler(testResult: TestResult, logger: Logger): boolean;
