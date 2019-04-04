/// <reference types="jest" />
import { Logger } from 'bs-logger';
import { CompilerOptions, CustomTransformers, ParsedCommandLine } from 'typescript';
import { AstTransformerDesc, BabelConfig, BabelJestTransformer, TTypeScript, TsCompiler, TsJestConfig, TsJestGlobalOptions, TsJestHooksMap } from '../types';
export declare class ConfigSet {
    readonly parentOptions?: TsJestGlobalOptions | undefined;
    readonly projectPackageJson: Record<string, any>;
    readonly projectDependencies: Record<string, string>;
    readonly jest: jest.ProjectConfig;
    readonly tsJest: TsJestConfig;
    readonly typescript: ParsedCommandLine;
    readonly tsconfig: any;
    readonly versions: Record<string, string>;
    readonly babel: BabelConfig | undefined;
    readonly compilerModule: TTypeScript;
    readonly babelJestTransformer: BabelJestTransformer | undefined;
    readonly tsCompiler: TsCompiler;
    readonly astTransformers: AstTransformerDesc[];
    readonly tsCustomTransformers: CustomTransformers;
    readonly hooks: TsJestHooksMap;
    readonly shouldReportDiagnostic: (filePath: string) => boolean;
    readonly shouldStringifyContent: (filePath: string) => boolean;
    readonly tsCacheDir: string | undefined;
    readonly overriddenCompilerOptions: Partial<CompilerOptions>;
    readonly rootDir: string;
    readonly cwd: string;
    readonly tsJestDigest: string;
    readonly cacheKey: string;
    readonly logger: Logger;
    constructor(jestConfig: jest.ProjectConfig, parentOptions?: TsJestGlobalOptions | undefined, parentLogger?: Logger);
    resolvePath(inputPath: string, { throwIfMissing, nodeResolve }?: {
        throwIfMissing?: boolean;
        nodeResolve?: boolean;
    }): string;
}
