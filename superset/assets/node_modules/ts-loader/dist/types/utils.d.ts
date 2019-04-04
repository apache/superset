import { Chalk } from 'chalk';
import * as typescript from 'typescript';
import { DependencyGraph, LoaderOptions, ReverseDependencyGraph, TSInstance, Webpack, WebpackError, WebpackModule } from './interfaces';
/**
 * Take TypeScript errors, parse them and format to webpack errors
 * Optionally adds a file name
 */
export declare function formatErrors(diagnostics: ReadonlyArray<typescript.Diagnostic> | undefined, loaderOptions: LoaderOptions, colors: Chalk, compiler: typeof typescript, merge: {
    file?: string;
    module?: WebpackModule;
}, context: string): WebpackError[];
export declare function readFile(fileName: string, encoding?: string | undefined): string | undefined;
export declare function makeError(message: string, file: string | undefined, location?: {
    line: number;
    character: number;
}): WebpackError;
export declare function appendSuffixIfMatch(patterns: RegExp[], filePath: string, suffix: string): string;
export declare function appendSuffixesIfMatch(suffixDict: {
    [suffix: string]: RegExp[];
}, filePath: string): string;
export declare function unorderedRemoveItem<T>(array: T[], item: T): boolean;
/**
 * Recursively collect all possible dependants of passed file
 */
export declare function collectAllDependants(reverseDependencyGraph: ReverseDependencyGraph, fileName: string, collected?: {
    [file: string]: boolean;
}): string[];
/**
 * Recursively collect all possible dependencies of passed file
 */
export declare function collectAllDependencies(dependencyGraph: DependencyGraph, filePath: string, collected?: {
    [file: string]: boolean;
}): string[];
export declare function arrify<T>(val: T | T[]): T[];
export declare function ensureProgram(instance: TSInstance): typescript.Program | undefined;
export declare function supportsProjectReferences(instance: TSInstance): true | undefined;
export declare function isUsingProjectReferences(instance: TSInstance): boolean;
/**
 * Gets the project reference for a file from the cache if it exists,
 * or gets it from TypeScript and caches it otherwise.
 */
export declare function getAndCacheProjectReference(filePath: string, instance: TSInstance): typescript.ResolvedProjectReference | undefined;
export declare function validateSourceMapOncePerProject(instance: TSInstance, loader: Webpack, jsFileName: string, project: typescript.ResolvedProjectReference): void;
/**
 * Gets the output JS file path for an input file governed by a composite project.
 * Pulls from the cache if it exists; computes and caches the result otherwise.
 */
export declare function getAndCacheOutputJSFileName(inputFileName: string, projectReference: typescript.ResolvedProjectReference, instance: TSInstance): string;
