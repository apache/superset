"use strict";
const loaderUtils = require("loader-utils");
const path = require("path");
const constants = require("./constants");
const instances_1 = require("./instances");
const utils_1 = require("./utils");
const webpackInstances = [];
const loaderOptionsCache = {};
/**
 * The entry point for ts-loader
 */
function loader(contents) {
    // tslint:disable-next-line:no-unused-expression strict-boolean-expressions
    this.cacheable && this.cacheable();
    const callback = this.async();
    const options = getLoaderOptions(this);
    const instanceOrError = instances_1.getTypeScriptInstance(options, this);
    if (instanceOrError.error !== undefined) {
        callback(new Error(instanceOrError.error.message));
        return;
    }
    return successLoader(this, contents, callback, options, instanceOrError.instance);
}
function successLoader(loaderContext, contents, callback, options, instance) {
    const rawFilePath = path.normalize(loaderContext.resourcePath);
    const filePath = options.appendTsSuffixTo.length > 0 || options.appendTsxSuffixTo.length > 0
        ? utils_1.appendSuffixesIfMatch({
            '.ts': options.appendTsSuffixTo,
            '.tsx': options.appendTsxSuffixTo
        }, rawFilePath)
        : rawFilePath;
    const fileVersion = updateFileInCache(filePath, contents, instance);
    const referencedProject = utils_1.getAndCacheProjectReference(filePath, instance);
    if (referencedProject !== undefined) {
        const [relativeProjectConfigPath, relativeFilePath] = [
            path.relative(loaderContext.rootContext, referencedProject.sourceFile.fileName),
            path.relative(loaderContext.rootContext, filePath)
        ];
        if (referencedProject.commandLine.options.outFile !== undefined) {
            throw new Error(`The referenced project at ${relativeProjectConfigPath} is using ` +
                `the outFile' option, which is not supported with ts-loader.`);
        }
        const jsFileName = utils_1.getAndCacheOutputJSFileName(filePath, referencedProject, instance);
        const relativeJSFileName = path.relative(loaderContext.rootContext, jsFileName);
        if (!instance.compiler.sys.fileExists(jsFileName)) {
            throw new Error(`Could not find output JavaScript file for input ` +
                `${relativeFilePath} (looked at ${relativeJSFileName}).\n` +
                `The input file is part of a project reference located at ` +
                `${relativeProjectConfigPath}, so ts-loader is looking for the ` +
                'project’s pre-built output on disk. Try running `tsc --build` ' +
                'to build project references.');
        }
        // Since the output JS file is being read from disk instead of using the
        // input TS file, we need to tell the loader that the compilation doesn’t
        // actually depend on the current file, but depends on the JS file instead.
        loaderContext.clearDependencies();
        loaderContext.addDependency(jsFileName);
        utils_1.validateSourceMapOncePerProject(instance, loaderContext, jsFileName, referencedProject);
        const mapFileName = jsFileName + '.map';
        const outputText = instance.compiler.sys.readFile(jsFileName);
        const sourceMapText = instance.compiler.sys.readFile(mapFileName);
        makeSourceMapAndFinish(sourceMapText, outputText, filePath, contents, loaderContext, options, fileVersion, callback);
    }
    else {
        const { outputText, sourceMapText } = options.transpileOnly
            ? getTranspilationEmit(filePath, contents, instance, loaderContext)
            : getEmit(rawFilePath, filePath, instance, loaderContext);
        makeSourceMapAndFinish(sourceMapText, outputText, filePath, contents, loaderContext, options, fileVersion, callback);
    }
}
function makeSourceMapAndFinish(sourceMapText, outputText, filePath, contents, loaderContext, options, fileVersion, callback) {
    if (outputText === null || outputText === undefined) {
        const additionalGuidance = !options.allowTsInNodeModules && filePath.indexOf('node_modules') !== -1
            ? ' By default, ts-loader will not compile .ts files in node_modules.\n' +
                'You should not need to recompile .ts files there, but if you really want to, use the allowTsInNodeModules option.\n' +
                'See: https://github.com/Microsoft/TypeScript/issues/12358'
            : '';
        throw new Error(`TypeScript emitted no output for ${filePath}.${additionalGuidance}`);
    }
    const { sourceMap, output } = makeSourceMap(sourceMapText, outputText, filePath, contents, loaderContext);
    // _module.meta is not available inside happypack
    if (!options.happyPackMode && loaderContext._module.buildMeta !== undefined) {
        // Make sure webpack is aware that even though the emitted JavaScript may be the same as
        // a previously cached version the TypeScript may be different and therefore should be
        // treated as new
        loaderContext._module.buildMeta.tsLoaderFileVersion = fileVersion;
    }
    callback(null, output, sourceMap);
}
/**
 * either retrieves loader options from the cache
 * or creates them, adds them to the cache and returns
 */
function getLoaderOptions(loaderContext) {
    // differentiate the TypeScript instance based on the webpack instance
    let webpackIndex = webpackInstances.indexOf(loaderContext._compiler);
    if (webpackIndex === -1) {
        webpackIndex = webpackInstances.push(loaderContext._compiler) - 1;
    }
    const loaderOptions = loaderUtils.getOptions(loaderContext) ||
        {};
    const instanceName = webpackIndex + '_' + (loaderOptions.instance || 'default');
    if (!loaderOptionsCache.hasOwnProperty(instanceName)) {
        loaderOptionsCache[instanceName] = new WeakMap();
    }
    const cache = loaderOptionsCache[instanceName];
    if (cache.has(loaderOptions)) {
        return cache.get(loaderOptions);
    }
    validateLoaderOptions(loaderOptions);
    const options = makeLoaderOptions(instanceName, loaderOptions);
    cache.set(loaderOptions, options);
    return options;
}
const validLoaderOptions = [
    'silent',
    'logLevel',
    'logInfoToStdOut',
    'instance',
    'compiler',
    'context',
    'configFile',
    'transpileOnly',
    'ignoreDiagnostics',
    'errorFormatter',
    'colors',
    'compilerOptions',
    'appendTsSuffixTo',
    'appendTsxSuffixTo',
    'onlyCompileBundledFiles',
    'happyPackMode',
    'getCustomTransformers',
    'reportFiles',
    'experimentalWatchApi',
    'allowTsInNodeModules',
    'experimentalFileCaching',
    'projectReferences',
    'resolveModuleName'
];
/**
 * Validate the supplied loader options.
 * At present this validates the option names only; in future we may look at validating the values too
 * @param loaderOptions
 */
function validateLoaderOptions(loaderOptions) {
    const loaderOptionKeys = Object.keys(loaderOptions);
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < loaderOptionKeys.length; i++) {
        const option = loaderOptionKeys[i];
        const isUnexpectedOption = validLoaderOptions.indexOf(option) === -1;
        if (isUnexpectedOption) {
            throw new Error(`ts-loader was supplied with an unexpected loader option: ${option}

Please take a look at the options you are supplying; the following are valid options:
${validLoaderOptions.join(' / ')}
`);
        }
    }
    if (loaderOptions.context !== undefined &&
        !path.isAbsolute(loaderOptions.context)) {
        throw new Error(`Option 'context' has to be an absolute path. Given '${loaderOptions.context}'.`);
    }
}
function makeLoaderOptions(instanceName, loaderOptions) {
    const options = Object.assign({}, {
        silent: false,
        logLevel: 'WARN',
        logInfoToStdOut: false,
        compiler: 'typescript',
        configFile: 'tsconfig.json',
        context: undefined,
        transpileOnly: false,
        compilerOptions: {},
        appendTsSuffixTo: [],
        appendTsxSuffixTo: [],
        transformers: {},
        happyPackMode: false,
        colors: true,
        onlyCompileBundledFiles: false,
        reportFiles: [],
        // When the watch API usage stabilises look to remove this option and make watch usage the default behaviour when available
        experimentalWatchApi: false,
        allowTsInNodeModules: false,
        experimentalFileCaching: false
    }, loaderOptions);
    options.ignoreDiagnostics = utils_1.arrify(options.ignoreDiagnostics).map(Number);
    options.logLevel = options.logLevel.toUpperCase();
    options.instance = instanceName;
    // happypack can be used only together with transpileOnly mode
    options.transpileOnly = options.happyPackMode ? true : options.transpileOnly;
    return options;
}
/**
 * Either add file to the overall files cache or update it in the cache when the file contents have changed
 * Also add the file to the modified files
 */
function updateFileInCache(filePath, contents, instance) {
    let fileWatcherEventKind;
    // Update file contents
    let file = instance.files.get(filePath);
    if (file === undefined) {
        file = instance.otherFiles.get(filePath);
        if (file !== undefined) {
            instance.otherFiles.delete(filePath);
            instance.files.set(filePath, file);
        }
        else {
            if (instance.watchHost !== undefined) {
                fileWatcherEventKind = instance.compiler.FileWatcherEventKind.Created;
            }
            file = { version: 0 };
            instance.files.set(filePath, file);
        }
        instance.changedFilesList = true;
    }
    if (instance.watchHost !== undefined && contents === undefined) {
        fileWatcherEventKind = instance.compiler.FileWatcherEventKind.Deleted;
    }
    if (file.text !== contents) {
        file.version++;
        file.text = contents;
        instance.version++;
        if (instance.watchHost !== undefined &&
            fileWatcherEventKind === undefined) {
            fileWatcherEventKind = instance.compiler.FileWatcherEventKind.Changed;
        }
    }
    if (instance.watchHost !== undefined && fileWatcherEventKind !== undefined) {
        instance.hasUnaccountedModifiedFiles = true;
        instance.watchHost.invokeFileWatcher(filePath, fileWatcherEventKind);
        instance.watchHost.invokeDirectoryWatcher(path.dirname(filePath), filePath);
    }
    // push this file to modified files hash.
    if (instance.modifiedFiles === null || instance.modifiedFiles === undefined) {
        instance.modifiedFiles = new Map();
    }
    instance.modifiedFiles.set(filePath, file);
    return file.version;
}
function getEmit(rawFilePath, filePath, instance, loaderContext) {
    const outputFiles = instances_1.getEmitOutput(instance, filePath);
    loaderContext.clearDependencies();
    loaderContext.addDependency(rawFilePath);
    const allDefinitionFiles = [...instance.files.keys()].filter(defFilePath => defFilePath.match(constants.dtsDtsxOrDtsDtsxMapRegex));
    // Make this file dependent on *all* definition files in the program
    const addDependency = loaderContext.addDependency.bind(loaderContext);
    allDefinitionFiles.forEach(addDependency);
    // Additionally make this file dependent on all imported files
    const fileDependencies = instance.dependencyGraph[filePath];
    const additionalDependencies = fileDependencies === undefined
        ? []
        : fileDependencies.map(({ resolvedFileName, originalFileName }) => {
            const projectReference = utils_1.getAndCacheProjectReference(resolvedFileName, instance);
            // In the case of dependencies that are part of a project reference,
            // the real dependency that webpack should watch is the JS output file.
            return projectReference !== undefined
                ? utils_1.getAndCacheOutputJSFileName(resolvedFileName, projectReference, instance)
                : originalFileName;
        });
    if (additionalDependencies.length > 0) {
        additionalDependencies.forEach(addDependency);
    }
    loaderContext._module.buildMeta.tsLoaderDefinitionFileVersions = allDefinitionFiles
        .concat(additionalDependencies)
        .map(defFilePath => defFilePath +
        '@' +
        (instance.files.get(defFilePath) || { version: '?' }).version);
    const outputFile = outputFiles
        .filter(file => file.name.match(constants.jsJsx))
        .pop();
    const outputText = outputFile === undefined ? undefined : outputFile.text;
    const sourceMapFile = outputFiles
        .filter(file => file.name.match(constants.jsJsxMap))
        .pop();
    const sourceMapText = sourceMapFile === undefined ? undefined : sourceMapFile.text;
    return { outputText, sourceMapText };
}
/**
 * Transpile file
 */
function getTranspilationEmit(fileName, contents, instance, loaderContext) {
    const { outputText, sourceMapText, diagnostics } = instance.compiler.transpileModule(contents, {
        compilerOptions: Object.assign({}, instance.compilerOptions, { rootDir: undefined }),
        transformers: instance.transformers,
        reportDiagnostics: true,
        fileName
    });
    // _module.errors is not available inside happypack - see https://github.com/TypeStrong/ts-loader/issues/336
    if (!instance.loaderOptions.happyPackMode) {
        const errors = utils_1.formatErrors(diagnostics, instance.loaderOptions, instance.colors, instance.compiler, { module: loaderContext._module }, loaderContext.context);
        loaderContext._module.errors.push(...errors);
    }
    return { outputText, sourceMapText };
}
function makeSourceMap(sourceMapText, outputText, filePath, contents, loaderContext) {
    if (sourceMapText === undefined) {
        return { output: outputText, sourceMap: undefined };
    }
    return {
        output: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ''),
        sourceMap: Object.assign(JSON.parse(sourceMapText), {
            sources: [loaderUtils.getRemainingRequest(loaderContext)],
            file: filePath,
            sourcesContent: [contents]
        })
    };
}
module.exports = loader;
