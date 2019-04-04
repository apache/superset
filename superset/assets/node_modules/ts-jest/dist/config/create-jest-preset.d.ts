/// <reference types="jest" />
export interface TsJestPresets {
    transform: Record<string, string>;
    testMatch?: string[];
    moduleFileExtensions?: string[];
}
export interface CreateJestPresetOptions {
    allowJs?: boolean;
}
export declare function createJestPreset({ allowJs }?: CreateJestPresetOptions, from?: jest.InitialOptions): TsJestPresets;
