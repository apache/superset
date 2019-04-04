"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const utils_1 = require("./utils");
function getConfigFile(compiler, colors, loader, loaderOptions, compilerCompatible, log, compilerDetailsLogMessage) {
    const configFilePath = findConfigFile(compiler, path.dirname(loader.resourcePath), loaderOptions.configFile);
    let configFileError;
    let configFile;
    if (configFilePath !== undefined) {
        if (compilerCompatible) {
            log.logInfo(`${compilerDetailsLogMessage} and ${configFilePath}`);
        }
        else {
            log.logInfo(`ts-loader: Using config file at ${configFilePath}`);
        }
        configFile = compiler.readConfigFile(configFilePath, compiler.sys.readFile);
        if (configFile.error !== undefined) {
            configFileError = utils_1.formatErrors([configFile.error], loaderOptions, colors, compiler, { file: configFilePath }, loader.context)[0];
        }
    }
    else {
        if (compilerCompatible) {
            log.logInfo(compilerDetailsLogMessage);
        }
        configFile = {
            config: {
                compilerOptions: {},
                files: []
            }
        };
    }
    if (configFileError === undefined) {
        configFile.config.compilerOptions = Object.assign({}, configFile.config.compilerOptions, loaderOptions.compilerOptions);
    }
    return {
        configFilePath,
        configFile,
        configFileError
    };
}
exports.getConfigFile = getConfigFile;
/**
 * Find a tsconfig file by name or by path.
 * By name, the tsconfig.json is found using the same method as `tsc`, starting in the current
 * directory and continuing up the parent directory chain.
 * By path, the file will be found by resolving the given path relative to the requesting entry file.
 *
 * @param compiler The TypeScript compiler instance
 * @param requestDirPath The directory in which the entry point requesting the tsconfig.json lies
 * @param configFile The tsconfig file name to look for or a path to that file
 * @return The absolute path to the tsconfig file, undefined if none was found.
 */
function findConfigFile(compiler, requestDirPath, configFile) {
    // If `configFile` is an absolute path, return it right away
    if (path.isAbsolute(configFile)) {
        return compiler.sys.fileExists(configFile) ? configFile : undefined;
    }
    // If `configFile` is a relative path, resolve it.
    // We define a relative path as: starts with
    // one or two dots + a common directory delimiter
    if (configFile.match(/^\.\.?(\/|\\)/) !== null) {
        const resolvedPath = path.resolve(requestDirPath, configFile);
        return compiler.sys.fileExists(resolvedPath) ? resolvedPath : undefined;
        // If `configFile` is a file name, find it in the directory tree
    }
    else {
        while (true) {
            const fileName = path.join(requestDirPath, configFile);
            if (compiler.sys.fileExists(fileName)) {
                return fileName;
            }
            const parentPath = path.dirname(requestDirPath);
            if (parentPath === requestDirPath) {
                break;
            }
            requestDirPath = parentPath;
        }
        return undefined;
    }
}
function getConfigParseResult(compiler, configFile, basePath) {
    const configParseResult = compiler.parseJsonConfigFileContent(configFile.config, compiler.sys, basePath);
    return configParseResult;
}
exports.getConfigParseResult = getConfigParseResult;
