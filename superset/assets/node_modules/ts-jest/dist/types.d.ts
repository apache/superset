/// <reference types="jest" />
import * as _babel from 'babel__core';
import _ts, { CompilerOptions, SourceFile, TransformerFactory } from 'typescript';
import { ConfigSet } from './config/config-set';
export declare type TBabelCore = typeof _babel;
export declare type TTypeScript = typeof _ts;
export declare type TBabelJest = Required<jest.Transformer>;
export declare type BabelJestTransformer = {
    [K in Exclude<keyof jest.Transformer, 'createTransformer'>]: Exclude<jest.Transformer[K], undefined>;
};
export declare type BabelConfig = _babel.TransformOptions;
export interface TsJestGlobalOptions {
    tsConfig?: boolean | string | CompilerOptions;
    isolatedModules?: boolean;
    compiler?: string;
    astTransformers?: string[];
    diagnostics?: boolean | {
        pretty?: boolean;
        ignoreCodes?: number | string | Array<number | string>;
        pathRegex?: RegExp | string;
        warnOnly?: boolean;
    };
    babelConfig?: boolean | string | BabelConfig;
    stringifyContentPathRegex?: string | RegExp;
}
interface TsJestConfig$tsConfig$file {
    kind: 'file';
    value: string | undefined;
}
interface TsJestConfig$tsConfig$inline {
    kind: 'inline';
    value: CompilerOptions;
}
declare type TsJestConfig$tsConfig = TsJestConfig$tsConfig$file | TsJestConfig$tsConfig$inline | undefined;
interface TsJestConfig$diagnostics {
    pretty: boolean;
    ignoreCodes: number[];
    pathRegex?: string | undefined;
    throws: boolean;
}
interface TsJestConfig$babelConfig$file {
    kind: 'file';
    value: string | undefined;
}
interface TsJestConfig$babelConfig$inline {
    kind: 'inline';
    value: BabelConfig;
}
declare type TsJestConfig$babelConfig = TsJestConfig$babelConfig$file | TsJestConfig$babelConfig$inline | undefined;
declare type TsJestConfig$stringifyContentPathRegex = string | undefined;
export interface TsJestConfig {
    tsConfig: TsJestConfig$tsConfig;
    isolatedModules: boolean;
    compiler: string;
    diagnostics: TsJestConfig$diagnostics;
    babelConfig: TsJestConfig$babelConfig;
    transformers: string[];
    stringifyContentPathRegex: TsJestConfig$stringifyContentPathRegex;
}
export interface TsJestHooksMap {
    afterProcess?(args: any[], result: string | jest.TransformedSource): string | jest.TransformedSource | void;
}
export interface TSCommon {
    version: typeof _ts.version;
    sys: typeof _ts.sys;
    ScriptSnapshot: typeof _ts.ScriptSnapshot;
    displayPartsToString: typeof _ts.displayPartsToString;
    createLanguageService: typeof _ts.createLanguageService;
    getDefaultLibFilePath: typeof _ts.getDefaultLibFilePath;
    getPreEmitDiagnostics: typeof _ts.getPreEmitDiagnostics;
    flattenDiagnosticMessageText: typeof _ts.flattenDiagnosticMessageText;
    transpileModule: typeof _ts.transpileModule;
    ModuleKind: typeof _ts.ModuleKind;
    ScriptTarget: typeof _ts.ScriptTarget;
    findConfigFile: typeof _ts.findConfigFile;
    readConfigFile: typeof _ts.readConfigFile;
    parseJsonConfigFileContent: typeof _ts.parseJsonConfigFileContent;
    formatDiagnostics: typeof _ts.formatDiagnostics;
    formatDiagnosticsWithColorAndContext: typeof _ts.formatDiagnosticsWithColorAndContext;
}
export interface TypeInfo {
    name: string;
    comment: string;
}
export interface TsCompiler {
    cwd: string;
    extensions: string[];
    cachedir: string | undefined;
    ts: TSCommon;
    compile(code: string, fileName: string, lineOffset?: number): string;
    getTypeInfo(code: string, fileName: string, position: number): TypeInfo;
}
export interface AstTransformerDesc {
    name: string;
    version: number;
    factory(cs: ConfigSet): TransformerFactory<SourceFile>;
}
export interface IPackageJson {
    main: string;
}
export {};
