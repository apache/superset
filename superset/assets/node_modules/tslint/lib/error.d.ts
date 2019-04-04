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
/**
 * Generic error typing for EcmaScript errors
 * Define `Error` here to avoid using `Error` from @types/node.
 * Using the `node` version causes a compilation error when this code is used as an npm library if @types/node is not already imported.
 */
export declare class Error {
    name?: string;
    message: string;
    stack?: string;
    constructor(message?: string);
}
/**
 * Used to exit the program and display a friendly message without the callstack.
 */
export declare class FatalError extends Error {
    message: string;
    innerError?: Error | undefined;
    static NAME: string;
    constructor(message: string, innerError?: Error | undefined);
}
export declare function isError(possibleError: any): possibleError is Error;
export declare function showWarningOnce(message: string): void;
export declare function showRuleCrashWarning(message: string, ruleName: string, fileName: string): void;
