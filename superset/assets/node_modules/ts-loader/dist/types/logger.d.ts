import { Chalk } from 'chalk';
import { LoaderOptions } from './interfaces';
declare type LoggerFunc = (message: string) => void;
export interface Logger {
    log: LoggerFunc;
    logInfo: LoggerFunc;
    logWarning: LoggerFunc;
    logError: LoggerFunc;
}
export declare function makeLogger(loaderOptions: LoaderOptions, colors: Chalk): Logger;
export {};
