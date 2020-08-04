// Type definitions for source-list-map v0.1.6
// Project: https://github.com/webpack/source-list-map.git
// Definitions by: e-cloud <https://github.com/e-cloud>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

export class CodeNode {
    generatedCode: string;

    constructor(generatedCode: string);

    clone(): CodeNode;

    getGeneratedCode(): string;

    getMappings(mappingsContext?: MappingsContext): string;

    addGeneratedCode(generatedCode: string): void;

    mapGeneratedCode(fn: (code: string) => string): void;
}

export class MappingsContext {
    sources: string[];
    sourcesContent: string[];
    hasSourceContent: boolean;
    currentOriginalLine: number;
    currentSource: number;

    constructor();

    ensureSource(source: string, originalSource: string): number;
}

export class SourceNode {
    generatedCode: string;
    source: string;
    originalSource: string;
    startingLine: number;

    constructor(generatedCode: string, source: string, originalSource: string, startingLine?: number);

    clone(): SourceNode;

    getGeneratedCode(): string;

    getMappings(mappingsContext: MappingsContext): string;

    mapGeneratedCode(fn: (code: string) => string): void;
}

export class SourceListMap {
    children: (SourceNode | CodeNode)[];

    constructor(generatedCode: (SourceNode | CodeNode)[]);
    constructor(
        generatedCode?: string | SourceNode | CodeNode | SourceListMap,
        source?: string,
        originalSource?: string
    );

    add(
        generatedCode: string | CodeNode | SourceNode | SourceListMap,
        source?: string,
        originalSource?: string
    ): void;

    prepend(generatedCode: SourceListMap | SourceNode | CodeNode, source?: string, originalSource?: string): void;

    mapGeneratedCode(fn: (code: string) => string): void;

    toString(): string;

    toStringWithSourceMap(options: { file: any }): {
        source: string;
        map: {
            version: number;
            file: any;
            sources: string[];
            sourcesContent: string[];
            mappings: string;
        };
    };
}

export function fromStringWithSourceMap(
    code: string, map: {
        sources: (string | SourceNode | CodeNode) [];
        sourcesContent: string[];
        mappings: string;
    }
): SourceListMap;
