import * as typescript from 'typescript';
import { LoaderOptions, TSInstance, Webpack, WebpackError } from './interfaces';
/**
 * The loader is executed once for each file seen by webpack. However, we need to keep
 * a persistent instance of TypeScript that contains all of the files in the program
 * along with definition files and options. This function either creates an instance
 * or returns the existing one. Multiple instances are possible by using the
 * `instance` property.
 */
export declare function getTypeScriptInstance(loaderOptions: LoaderOptions, loader: Webpack): {
    instance?: TSInstance;
    error?: WebpackError;
};
export declare function getEmitOutput(instance: TSInstance, filePath: string): typescript.OutputFile[];
