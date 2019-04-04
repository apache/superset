import * as typescript from 'typescript';
import { TSInstance, WatchHost, Webpack } from './interfaces';
import * as logger from './logger';
export declare type Action = () => void;
export interface ServiceHostWhichMayBeCacheable {
    servicesHost: typescript.LanguageServiceHost;
    clearCache: Action | null;
}
/**
 * Create the TypeScript language service
 */
export declare function makeServicesHost(scriptRegex: RegExp, log: logger.Logger, loader: Webpack, instance: TSInstance, enableFileCaching: boolean, projectReferences?: ReadonlyArray<typescript.ProjectReference>): ServiceHostWhichMayBeCacheable;
/**
 * Create the TypeScript Watch host
 */
export declare function makeWatchHost(scriptRegex: RegExp, log: logger.Logger, loader: Webpack, instance: TSInstance, appendTsSuffixTo: RegExp[], appendTsxSuffixTo: RegExp[], projectReferences?: ReadonlyArray<typescript.ProjectReference>): WatchHost;
