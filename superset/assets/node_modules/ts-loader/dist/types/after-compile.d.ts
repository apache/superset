import { TSInstance, WebpackCompilation } from './interfaces';
export declare function makeAfterCompile(instance: TSInstance, configFilePath: string | undefined): (compilation: WebpackCompilation, callback: () => void) => void;
