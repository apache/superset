import { LoaderOptions, Webpack } from './interfaces';
/**
 * The entry point for ts-loader
 */
declare function loader(this: Webpack, contents: string): void;
export = loader;
/**
 * expose public types via declaration merging
 */
declare namespace loader {
    interface Options extends LoaderOptions {
    }
}
