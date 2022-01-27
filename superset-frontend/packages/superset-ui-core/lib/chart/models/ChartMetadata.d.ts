import { Behavior } from '../types/Base';
interface LookupTable {
    [key: string]: boolean;
}
export interface ExampleImage {
    url: string;
    caption?: string;
}
export interface ChartMetadataConfig {
    name: string;
    canBeAnnotationTypes?: string[];
    credits?: string[];
    description?: string;
    datasourceCount?: number;
    enableNoResults?: boolean;
    show?: boolean;
    supportedAnnotationTypes?: string[];
    thumbnail: string;
    useLegacyApi?: boolean;
    behaviors?: Behavior[];
    deprecated?: boolean;
    exampleGallery?: ExampleImage[];
    tags?: string[];
    category?: string | null;
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
    behaviors: Behavior[];
    datasourceCount: number;
    enableNoResults: boolean;
    deprecated: boolean;
    exampleGallery: ExampleImage[];
    tags: string[];
    category: string | null;
    constructor(config: ChartMetadataConfig);
    canBeAnnotationType(type: string): boolean;
    clone(): ChartMetadata;
}
export {};
//# sourceMappingURL=ChartMetadata.d.ts.map