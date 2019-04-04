import { Chalk } from 'chalk';
import * as typescript from 'typescript';
import { LoaderOptions, Webpack, WebpackError } from './interfaces';
import * as logger from './logger';
interface ConfigFile {
    config?: any;
    error?: typescript.Diagnostic;
}
export declare function getConfigFile(compiler: typeof typescript, colors: Chalk, loader: Webpack, loaderOptions: LoaderOptions, compilerCompatible: boolean, log: logger.Logger, compilerDetailsLogMessage: string): {
    configFilePath: string | undefined;
    configFile: ConfigFile;
    configFileError: WebpackError | undefined;
};
export declare function getConfigParseResult(compiler: typeof typescript, configFile: ConfigFile, basePath: string): typescript.ParsedCommandLine;
export {};
