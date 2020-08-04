interface LookupTable {
    [key: string]: boolean;
}
export interface ChartMetadataConfig {
    name: string;
    canBeAnnotationTypes?: string[];
    credits?: string[];
    description?: string;
    show?: boolean;
    supportedAnnotationTypes?: string[];
    thumbnail: string;
    useLegacyApi?: boolean;
}
export default class ChartMetadata {
    name: string;
    canBeAnnotationTypes?: string[];
    canBeAnnotationTypesLookup: LookupTable;
    credits: string[];
    description: string;
    show: boolean;
    supportedAnnotationTypes: string[];
    thumbnail: string;
    useLegacyApi: boolean;
    constructor(config: ChartMetadataConfig);
    canBeAnnotationType(type: string): boolean;
    clone(): ChartMetadata;
}
export {};
//# sourceMappingURL=ChartMetadata.d.ts.map