"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const micromatch = require("micromatch");
const path = require("path");
const typescript = require("typescript");
const constants = require("./constants");
/**
 * The default error formatter.
 */
function defaultErrorFormatter(error, colors) {
    const messageColor = error.severity === 'warning' ? colors.bold.yellow : colors.bold.red;
    return (colors.grey('[tsl] ') +
        messageColor(error.severity.toUpperCase()) +
        (error.file === ''
            ? ''
            : messageColor(' in ') +
                colors.bold.cyan(`${error.file}(${error.line},${error.character})`)) +
        constants.EOL +
        messageColor(`      TS${error.code}: ${error.content}`));
}
/**
 * Take TypeScript errors, parse them and format to webpack errors
 * Optionally adds a file name
 */
function formatErrors(diagnostics, loaderOptions, colors, compiler, merge, context) {
    return diagnostics === undefined
        ? []
        : diagnostics
            .filter(diagnostic => {
            if (loaderOptions.ignoreDiagnostics.indexOf(diagnostic.code) !== -1) {
                return false;
            }
            if (loaderOptions.reportFiles.length > 0 &&
                diagnostic.file !== undefined) {
                const relativeFileName = path.relative(context, diagnostic.file.fileName);
                const matchResult = micromatch([relativeFileName], loaderOptions.reportFiles);
                if (matchResult.length === 0) {
                    return false;
                }
            }
            return true;
        })
            .map(diagnostic => {
            const file = diagnostic.file;
            const position = file === undefined
                ? undefined
                : file.getLineAndCharacterOfPosition(diagnostic.start);
            const errorInfo = {
                code: diagnostic.code,
                severity: compiler.DiagnosticCategory[diagnostic.category].toLowerCase(),
                content: compiler.flattenDiagnosticMessageText(diagnostic.messageText, constants.EOL),
                file: file === undefined ? '' : path.normalize(file.fileName),
                line: position === undefined ? 0 : position.line + 1,
                character: position === undefined ? 0 : position.character + 1,
                context
            };
            const message = loaderOptions.errorFormatter === undefined
                ? defaultErrorFormatter(errorInfo, colors)
                : loaderOptions.errorFormatter(errorInfo, colors);
            const error = makeError(message, merge.file === undefined ? errorInfo.file : merge.file, position === undefined
                ? undefined
                : { line: errorInfo.line, character: errorInfo.character });
            return Object.assign(error, merge);
        });
}
exports.formatErrors = formatErrors;
function readFile(fileName, encoding = 'utf8') {
    fileName = path.normalize(fileName);
    try {
        return fs.readFileSync(fileName, encoding);
    }
    catch (e) {
        return undefined;
    }
}
exports.readFile = readFile;
function makeError(message, file, location) {
    return {
        message,
        location,
        file,
        loaderSource: 'ts-loader'
    };
}
exports.makeError = makeError;
function appendSuffixIfMatch(patterns, filePath, suffix) {
    if (patterns.length > 0) {
        for (const regexp of patterns) {
            if (filePath.match(regexp) !== null) {
                return filePath + suffix;
            }
        }
    }
    return filePath;
}
exports.appendSuffixIfMatch = appendSuffixIfMatch;
function appendSuffixesIfMatch(suffixDict, filePath) {
    let amendedPath = filePath;
    for (const suffix in suffixDict) {
        amendedPath = appendSuffixIfMatch(suffixDict[suffix], amendedPath, suffix);
    }
    return amendedPath;
}
exports.appendSuffixesIfMatch = appendSuffixesIfMatch;
function unorderedRemoveItem(array, item) {
    for (let i = 0; i < array.length; i++) {
        if (array[i] === item) {
            // Fill in the "hole" left at `index`.
            array[i] = array[array.length - 1];
            array.pop();
            return true;
        }
    }
    return false;
}
exports.unorderedRemoveItem = unorderedRemoveItem;
/**
 * Recursively collect all possible dependants of passed file
 */
function collectAllDependants(reverseDependencyGraph, fileName, collected = {}) {
    const result = {};
    result[fileName] = true;
    collected[fileName] = true;
    const dependants = reverseDependencyGraph[fileName];
    if (dependants !== undefined) {
        Object.keys(dependants).forEach(dependantFileName => {
            if (!collected[dependantFileName]) {
                collectAllDependants(reverseDependencyGraph, dependantFileName, collected).forEach(fName => (result[fName] = true));
            }
        });
    }
    return Object.keys(result);
}
exports.collectAllDependants = collectAllDependants;
/**
 * Recursively collect all possible dependencies of passed file
 */
function collectAllDependencies(dependencyGraph, filePath, collected = {}) {
    const result = {};
    result[filePath] = true;
    collected[filePath] = true;
    const directDependencies = dependencyGraph[filePath];
    if (directDependencies !== undefined) {
        directDependencies.forEach(dependencyModule => {
            if (!collected[dependencyModule.originalFileName]) {
                collectAllDependencies(dependencyGraph, dependencyModule.resolvedFileName, collected).forEach(depFilePath => (result[depFilePath] = true));
            }
        });
    }
    return Object.keys(result);
}
exports.collectAllDependencies = collectAllDependencies;
function arrify(val) {
    if (val === null || val === undefined) {
        return [];
    }
    return Array.isArray(val) ? val : [val];
}
exports.arrify = arrify;
function ensureProgram(instance) {
    if (instance && instance.watchHost) {
        if (instance.hasUnaccountedModifiedFiles) {
            if (instance.changedFilesList) {
                instance.watchHost.updateRootFileNames();
            }
            if (instance.watchOfFilesAndCompilerOptions) {
                instance.program = instance.watchOfFilesAndCompilerOptions
                    .getProgram()
                    .getProgram();
            }
            instance.hasUnaccountedModifiedFiles = false;
        }
        return instance.program;
    }
    if (instance.languageService) {
        return instance.languageService.getProgram();
    }
    return instance.program;
}
exports.ensureProgram = ensureProgram;
function supportsProjectReferences(instance) {
    const program = ensureProgram(instance);
    return program && !!program.getProjectReferences;
}
exports.supportsProjectReferences = supportsProjectReferences;
function isUsingProjectReferences(instance) {
    if (instance.loaderOptions.projectReferences &&
        supportsProjectReferences(instance)) {
        const program = ensureProgram(instance);
        return Boolean(program && program.getProjectReferences());
    }
    return false;
}
exports.isUsingProjectReferences = isUsingProjectReferences;
/**
 * Gets the project reference for a file from the cache if it exists,
 * or gets it from TypeScript and caches it otherwise.
 */
function getAndCacheProjectReference(filePath, instance) {
    const file = instance.files.get(filePath);
    if (file !== undefined && file.projectReference) {
        return file.projectReference.project;
    }
    const projectReference = getProjectReferenceForFile(filePath, instance);
    if (file !== undefined) {
        file.projectReference = { project: projectReference };
    }
    return projectReference;
}
exports.getAndCacheProjectReference = getAndCacheProjectReference;
function getResolvedProjectReferences(program) {
    const getProjectReferences = program.getResolvedProjectReferences ||
        program.getProjectReferences;
    if (getProjectReferences) {
        return getProjectReferences();
    }
    return;
}
function getProjectReferenceForFile(filePath, instance) {
    if (isUsingProjectReferences(instance)) {
        const program = ensureProgram(instance);
        return (program &&
            getResolvedProjectReferences(program).find(ref => (ref &&
                ref.commandLine.fileNames.some(file => path.normalize(file) === filePath)) ||
                false));
    }
    return;
}
function validateSourceMapOncePerProject(instance, loader, jsFileName, project) {
    const { projectsMissingSourceMaps = new Set() } = instance;
    if (!projectsMissingSourceMaps.has(project.sourceFile.fileName)) {
        instance.projectsMissingSourceMaps = projectsMissingSourceMaps;
        projectsMissingSourceMaps.add(project.sourceFile.fileName);
        const mapFileName = jsFileName + '.map';
        if (!instance.compiler.sys.fileExists(mapFileName)) {
            const [relativeJSPath, relativeProjectConfigPath] = [
                path.relative(loader.rootContext, jsFileName),
                path.relative(loader.rootContext, project.sourceFile.fileName)
            ];
            loader.emitWarning(new Error('Could not find source map file for referenced project output ' +
                `${relativeJSPath}. Ensure the 'sourceMap' compiler option ` +
                `is enabled in ${relativeProjectConfigPath} to ensure Webpack ` +
                'can map project references to the appropriate source files.'));
        }
    }
}
exports.validateSourceMapOncePerProject = validateSourceMapOncePerProject;
/**
 * Gets the output JS file path for an input file governed by a composite project.
 * Pulls from the cache if it exists; computes and caches the result otherwise.
 */
function getAndCacheOutputJSFileName(inputFileName, projectReference, instance) {
    const file = instance.files.get(inputFileName);
    if (file && file.projectReference && file.projectReference.outputFileName) {
        return file.projectReference.outputFileName;
    }
    const outputFileName = getOutputJavaScriptFileName(inputFileName, projectReference);
    if (file !== undefined) {
        file.projectReference = file.projectReference || {
            project: projectReference
        };
        file.projectReference.outputFileName = outputFileName;
    }
    return outputFileName;
}
exports.getAndCacheOutputJSFileName = getAndCacheOutputJSFileName;
// Adapted from https://github.com/Microsoft/TypeScript/blob/45101491c0b077c509b25830ef0ee5f85b293754/src/compiler/tsbuild.ts#L305
function getOutputJavaScriptFileName(inputFileName, projectReference) {
    const { options } = projectReference.commandLine;
    const projectDirectory = options.rootDir || path.dirname(projectReference.sourceFile.fileName);
    const relativePath = path.relative(projectDirectory, inputFileName);
    const outputPath = path.resolve(options.outDir || projectDirectory, relativePath);
    const newExtension = constants.jsonRegex.test(inputFileName)
        ? '.json'
        : constants.tsxRegex.test(inputFileName) &&
            options.jsx === typescript.JsxEmit.Preserve
            ? '.jsx'
            : '.js';
    return outputPath.replace(constants.extensionRegex, newExtension);
}
