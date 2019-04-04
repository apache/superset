import { TSInstance, WebpackCompiler } from './interfaces';
/**
 * Make function which will manually update changed files
 */
export declare function makeWatchRun(instance: TSInstance): (compiler: WebpackCompiler, callback: () => void) => void;
