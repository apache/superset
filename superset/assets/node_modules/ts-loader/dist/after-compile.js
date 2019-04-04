"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const constants = require("./constants");
const instances_1 = require("./instances");
const utils_1 = require("./utils");
function makeAfterCompile(instance, configFilePath) {
    let getCompilerOptionDiagnostics = true;
    let checkAllFilesForErrors = true;
    return (compilation, callback) => {
        // Don't add errors for child compilations
        if (compilation.compiler.isChild()) {
            callback();
            return;
        }
        removeTSLoaderErrors(compilation.errors);
        provideCompilerOptionDiagnosticErrorsToWebpack(getCompilerOptionDiagnostics, compilation, instance, configFilePath);
        getCompilerOptionDiagnostics = false;
        const modules = determineModules(compilation);
        const filesToCheckForErrors = determineFilesToCheckForErrors(checkAllFilesForErrors, instance);
        checkAllFilesForErrors = false;
        const filesWithErrors = new Map();
        provideErrorsToWebpack(filesToCheckForErrors, filesWithErrors, compilation, modules, instance);
        provideDeclarationFilesToWebpack(filesToCheckForErrors, instance, compilation);
        instance.filesWithErrors = filesWithErrors;
        instance.modifiedFiles = null;
        instance.projectsMissingSourceMaps = new Set();
        callback();
    };
}
exports.makeAfterCompile = makeAfterCompile;
/**
 * handle compiler option errors after the first compile
 */
function provideCompilerOptionDiagnosticErrorsToWebpack(getCompilerOptionDiagnostics, compilation, instance, configFilePath) {
    if (getCompilerOptionDiagnostics) {
        const { languageService, loaderOptions, compiler, program } = instance;
        const errorsToAdd = utils_1.formatErrors(program === undefined
            ? languageService.getCompilerOptionsDiagnostics()
            : program.getOptionsDiagnostics(), loaderOptions, instance.colors, compiler, { file: configFilePath || 'tsconfig.json' }, compilation.compiler.context);
        compilation.errors.push(...errorsToAdd);
    }
}
/**
 * build map of all modules based on normalized filename
 * this is used for quick-lookup when trying to find modules
 * based on filepath
 */
function determineModules(compilation) {
    // TODO: Convert to reduce
    const modules = new Map();
    compilation.modules.forEach(module => {
        if (module.resource) {
            const modulePath = path.normalize(module.resource);
            const existingModules = modules.get(modulePath);
            if (existingModules !== undefined) {
                if (existingModules.indexOf(module) === -1) {
                    existingModules.push(module);
                }
            }
            else {
                modules.set(modulePath, [module]);
            }
        }
    });
    return modules;
}
function determineFilesToCheckForErrors(checkAllFilesForErrors, instance) {
    const { files, modifiedFiles, filesWithErrors, otherFiles } = instance;
    // calculate array of files to check
    const filesToCheckForErrors = new Map();
    if (checkAllFilesForErrors) {
        // check all files on initial run
        for (const [filePath, file] of files) {
            filesToCheckForErrors.set(filePath, file);
        }
        for (const [filePath, file] of otherFiles) {
            filesToCheckForErrors.set(filePath, file);
        }
    }
    else if (modifiedFiles !== null && modifiedFiles !== undefined) {
        // check all modified files, and all dependants
        for (const modifiedFileName of modifiedFiles.keys()) {
            utils_1.collectAllDependants(instance.reverseDependencyGraph, modifiedFileName).forEach(fileName => {
                const fileToCheckForErrors = files.get(fileName) || otherFiles.get(fileName);
                filesToCheckForErrors.set(fileName, fileToCheckForErrors);
            });
        }
    }
    // re-check files with errors from previous build
    if (filesWithErrors !== undefined) {
        for (const [fileWithErrorName, fileWithErrors] of filesWithErrors) {
            filesToCheckForErrors.set(fileWithErrorName, fileWithErrors);
        }
    }
    return filesToCheckForErrors;
}
function provideErrorsToWebpack(filesToCheckForErrors, filesWithErrors, compilation, modules, instance) {
    const { compiler, program, languageService, files, loaderOptions, compilerOptions, otherFiles } = instance;
    const filePathRegex = compilerOptions.checkJs === true
        ? constants.dtsTsTsxJsJsxRegex
        : constants.dtsTsTsxRegex;
    for (const filePath of filesToCheckForErrors.keys()) {
        if (filePath.match(filePathRegex) === null) {
            continue;
        }
        const sourceFile = program === undefined ? undefined : program.getSourceFile(filePath);
        // If the source file is undefined, that probably means it’s actually part of an unbuilt project reference,
        // which will have already produced a more useful error than the one we would get by proceeding here.
        // If it’s undefined and we’re not using project references at all, I guess carry on so the user will
        // get a useful error about which file was unexpectedly missing.
        if (utils_1.isUsingProjectReferences(instance) && sourceFile === undefined) {
            continue;
        }
        const errors = program === undefined
            ? [
                ...languageService.getSyntacticDiagnostics(filePath),
                ...languageService.getSemanticDiagnostics(filePath)
            ]
            : [
                ...program.getSyntacticDiagnostics(sourceFile),
                ...program.getSemanticDiagnostics(sourceFile)
            ];
        if (errors.length > 0) {
            const fileWithError = files.get(filePath) || otherFiles.get(filePath);
            filesWithErrors.set(filePath, fileWithError);
        }
        // if we have access to a webpack module, use that
        const associatedModules = modules.get(filePath);
        if (associatedModules !== undefined) {
            associatedModules.forEach(module => {
                // remove any existing errors
                removeTSLoaderErrors(module.errors);
                // append errors
                const formattedErrors = utils_1.formatErrors(errors, loaderOptions, instance.colors, compiler, { module }, compilation.compiler.context);
                module.errors.push(...formattedErrors);
                compilation.errors.push(...formattedErrors);
            });
        }
        else {
            // otherwise it's a more generic error
            const formattedErrors = utils_1.formatErrors(errors, loaderOptions, instance.colors, compiler, { file: filePath }, compilation.compiler.context);
            compilation.errors.push(...formattedErrors);
        }
    }
}
/**
 * gather all declaration files from TypeScript and output them to webpack
 */
function provideDeclarationFilesToWebpack(filesToCheckForErrors, instance, compilation) {
    for (const filePath of filesToCheckForErrors.keys()) {
        if (filePath.match(constants.tsTsxRegex) === null) {
            continue;
        }
        const outputFiles = instances_1.getEmitOutput(instance, filePath);
        const declarationFiles = outputFiles.filter(outputFile => outputFile.name.match(constants.dtsDtsxOrDtsDtsxMapRegex));
        declarationFiles.forEach(declarationFile => {
            const assetPath = path.relative(compilation.compiler.outputPath, declarationFile.name);
            compilation.assets[assetPath] = {
                source: () => declarationFile.text,
                size: () => declarationFile.text.length
            };
        });
    }
}
/**
 * handle all other errors. The basic approach here to get accurate error
 * reporting is to start with a "blank slate" each compilation and gather
 * all errors from all files. Since webpack tracks errors in a module from
 * compilation-to-compilation, and since not every module always runs through
 * the loader, we need to detect and remove any pre-existing errors.
 */
function removeTSLoaderErrors(errors) {
    let index = -1;
    let length = errors.length;
    while (++index < length) {
        if (errors[index].loaderSource === 'ts-loader') {
            errors.splice(index--, 1);
            length--;
        }
    }
}
