import * as typescript from 'typescript';
export { ModuleResolutionHost } from 'typescript';
import { Chalk } from 'chalk';
export interface SourceMap {
    sources: any[];
    file: string;
    sourcesContent: string[];
}
export interface ErrorInfo {
    code: number;
    severity: Severity;
    content: string;
    file: string;
    line: number;
    character: number;
    context: string;
}
export declare type AsyncCallback = (err: Error | WebpackError | null, source?: string, map?: string) => void;
/**
 * Details here: https://webpack.github.io/docs/loaders.html#loader-context
 */
export interface Webpack {
    _compiler: Compiler;
    _module: WebpackModule;
    /**
     * Make this loader result cacheable. By default it’s not cacheable.
     *
     * A cacheable loader must have a deterministic result, when inputs and dependencies haven’t changed. This means the loader shouldn’t have other dependencies than specified with this.addDependency. Most loaders are deterministic and cacheable.
     */
    cacheable: () => void;
    /**
     * The directory of the module. Can be used as context for resolving other stuff.
     */
    context: string;
    /**
     * The root directory of the Webpack project.
     * Starting with webpack 4, the formerly `this.options.context` is provided as `this.rootContext`.
     */
    rootContext: string;
    /**
     * The resolved request string.
     * eg: "/abc/loader1.js?xyz!/abc/node_modules/loader2/index.js!/abc/resource.js?rrr"
     */
    request: string;
    /**
     * The query of the request for the current loader.
     */
    query: string;
    /**
     * A data object shared between the pitch and the normal phase.
     */
    data: Object;
    async: () => AsyncCallback;
    /**
     * The resource part of the request, including query.
     * eg: "/abc/resource.js?rrr"
     */
    resource: string;
    /**
     * The resource file.
     * eg: "/abc/resource.js"
     */
    resourcePath: string;
    /**
     * The query of the resource.
     * eg: "?rrr"
     */
    resourceQuery: string;
    /**
     * Resolve a request like a require expression.
     */
    resolve: (context: string, request: string, callback: (err: Error, result: string) => void) => void;
    /**
     * Resolve a request like a require expression.
     */
    resolveSync: (context: string, request: string) => string;
    /**
     * Add a file as dependency of the loader result in order to make them watchable.
     */
    addDependency: (file: string) => void;
    /**
     * Add a directory as dependency of the loader result.
     */
    addContextDependency: (directory: string) => void;
    /**
     * Remove all dependencies of the loader result. Even initial dependencies and these of other loaders. Consider using pitch.
     */
    clearDependencies: () => void;
    /**
     * Emit a warning.
     */
    emitWarning: (message: Error) => void;
    /**
     * Emit an error.
     */
    emitError: (message: Error) => void;
    /**
     * Emit a file. This is webpack-specific
     */
    emitFile: (fileName: string, text: string) => void;
}
export interface Compiler {
    plugin: (name: string, callback: Function) => void;
    hooks: any;
    /**
     * The options passed to the Compiler.
     */
    options: {
        resolve: Resolve;
    };
}
export declare type FileLocation = {
    line: number;
    character: number;
};
export interface WebpackError {
    module?: any;
    file?: string;
    message: string;
    location?: FileLocation;
    loaderSource: string;
}
/**
 * webpack/lib/Compilation.js
 */
export interface WebpackCompilation {
    compiler: WebpackCompiler;
    errors: WebpackError[];
    modules: WebpackModule[];
    assets: {
        [index: string]: {
            size: () => number;
            source: () => string;
        };
    };
}
/**
 * webpack/lib/Compiler.js
 */
export interface WebpackCompiler {
    isChild(): boolean;
    context: string;
    outputPath: string;
    watchFileSystem: WebpackNodeWatchFileSystem;
    /** key is filepath and value is Date as a number */
    fileTimestamps: Map<string, number>;
}
export interface WebpackModule {
    resource: string;
    errors: WebpackError[];
    buildMeta: {
        tsLoaderFileVersion: number;
        tsLoaderDefinitionFileVersions: string[];
    };
}
export interface Watcher {
    getTimes(): {
        [filePath: string]: number;
    };
}
export interface WebpackNodeWatchFileSystem {
    watcher?: Watcher;
    wfs?: {
        watcher: Watcher;
    };
}
export interface Resolve {
    /** Replace modules by other modules or paths. */
    alias?: {
        [key: string]: string;
    };
    /**
     * The directory (absolute path) that contains your modules.
     * May also be an array of directories.
     * This setting should be used to add individual directories to the search path.
     */
    root?: string | string[];
    /**
     * An array of directory names to be resolved to the current directory as well as its ancestors, and searched for modules.
     * This functions similarly to how node finds “node_modules” directories.
     * For example, if the value is ["mydir"], webpack will look in “./mydir”, “../mydir”, “../../mydir”, etc.
     */
    modulesDirectories?: string[];
    /**
     * A directory (or array of directories absolute paths),
     * in which webpack should look for modules that weren’t found in resolve.root or resolve.modulesDirectories.
     */
    fallback?: string | string[];
    /**
     * An array of extensions that should be used to resolve modules.
     * For example, in order to discover CoffeeScript files, your array should contain the string ".coffee".
     */
    extensions?: string[];
    /** Check these fields in the package.json for suitable files. */
    packageMains?: Array<string | string[]>;
    /** Check this field in the package.json for an object. Key-value-pairs are threaded as aliasing according to this spec */
    packageAlias?: Array<string | string[]>;
    /**
     * Enable aggressive but unsafe caching for the resolving of a part of your files.
     * Changes to cached paths may cause failure (in rare cases). An array of RegExps, only a RegExp or true (all files) is expected.
     * If the resolved path matches, it’ll be cached.
     */
    unsafeCache?: RegExp | RegExp[] | boolean;
}
export declare type ResolveSync = (context: string | undefined, path: string, moduleName: string) => string;
export interface WatchHost extends typescript.WatchCompilerHostOfFilesAndCompilerOptions<typescript.BuilderProgram> {
    invokeFileWatcher(fileName: string, eventKind: typescript.FileWatcherEventKind): void;
    invokeDirectoryWatcher(directory: string, fileAddedOrRemoved: string): void;
    updateRootFileNames(): void;
}
export interface TSInstance {
    compiler: typeof typescript;
    compilerOptions: typescript.CompilerOptions;
    loaderOptions: LoaderOptions;
    /**
     * a cache of all the files
     */
    files: TSFiles;
    /**
     * contains the modified files - cleared each time after-compile is called
     */
    modifiedFiles?: TSFiles | null;
    /**
     * Paths to project references that are missing source maps.
     * Cleared each time after-compile is called. Used to dedupe
     * warnings about source maps during a single compilation.
     */
    projectsMissingSourceMaps?: Set<string>;
    languageService?: typescript.LanguageService | null;
    version?: number;
    dependencyGraph: DependencyGraph;
    reverseDependencyGraph: ReverseDependencyGraph;
    filesWithErrors?: TSFiles;
    transformers: typescript.CustomTransformers;
    colors: Chalk;
    otherFiles: TSFiles;
    watchHost?: WatchHost;
    watchOfFilesAndCompilerOptions?: typescript.WatchOfFilesAndCompilerOptions<typescript.BuilderProgram>;
    program?: typescript.Program;
    hasUnaccountedModifiedFiles?: boolean;
    changedFilesList?: boolean;
}
export interface LoaderOptionsCache {
    [name: string]: WeakMap<LoaderOptions, LoaderOptions>;
}
export interface TSInstances {
    [name: string]: TSInstance;
}
export interface DependencyGraph {
    [file: string]: ResolvedModule[] | undefined;
}
export interface ReverseDependencyGraph {
    [file: string]: {
        [file: string]: boolean;
    } | undefined;
}
export declare type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export declare type ResolveModuleName = (moduleName: string, containingFile: string, compilerOptions: typescript.CompilerOptions, moduleResolutionHost: typescript.ModuleResolutionHost) => typescript.ResolvedModuleWithFailedLookupLocations;
export declare type CustomResolveModuleName = (moduleName: string, containingFile: string, compilerOptions: typescript.CompilerOptions, moduleResolutionHost: typescript.ModuleResolutionHost, parentResolver: ResolveModuleName) => typescript.ResolvedModuleWithFailedLookupLocations;
export interface LoaderOptions {
    silent: boolean;
    logLevel: LogLevel;
    logInfoToStdOut: boolean;
    instance: string;
    compiler: string;
    configFile: string;
    context: string;
    transpileOnly: boolean;
    ignoreDiagnostics: number[];
    reportFiles: string[];
    errorFormatter: (message: ErrorInfo, colors: Chalk) => string;
    onlyCompileBundledFiles: boolean;
    colors: boolean;
    compilerOptions: typescript.CompilerOptions;
    appendTsSuffixTo: RegExp[];
    appendTsxSuffixTo: RegExp[];
    happyPackMode: boolean;
    getCustomTransformers?: string | (() => typescript.CustomTransformers | undefined);
    experimentalWatchApi: boolean;
    allowTsInNodeModules: boolean;
    experimentalFileCaching: boolean;
    projectReferences: boolean;
    resolveModuleName?: CustomResolveModuleName;
}
export interface TSFile {
    text?: string;
    version: number;
    projectReference?: {
        /**
         * Undefined here means we’ve already checked and confirmed there is no
         * project reference for the file. Don’t bother checking again.
         */
        project?: typescript.ResolvedProjectReference;
        outputFileName?: string;
    };
}
/** where key is filepath */
export declare type TSFiles = Map<string, TSFile>;
export interface ResolvedModule {
    originalFileName: string;
    resolvedFileName: string;
    resolvedModule?: ResolvedModule;
    isExternalLibraryImport?: boolean;
}
export declare type Severity = 'error' | 'warning';
