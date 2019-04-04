/// <reference types="jest" />
import { Logger } from 'bs-logger';
import { ConfigSet } from './config/config-set';
import { TsJestGlobalOptions } from './types';
export declare class TsJestTransformer implements jest.Transformer {
    static readonly lastTransformerId: number;
    readonly logger: Logger;
    readonly id: number;
    readonly options: TsJestGlobalOptions;
    constructor(baseOptions?: TsJestGlobalOptions);
    configsFor(jestConfig: jest.ProjectConfig | string): ConfigSet;
    process(input: string, filePath: jest.Path, jestConfig: jest.ProjectConfig, transformOptions?: jest.TransformOptions): jest.TransformedSource | string;
    getCacheKey(fileContent: string, filePath: string, jestConfigStr: string, transformOptions?: {
        instrument?: boolean;
        rootDir?: string;
    }): string;
}
