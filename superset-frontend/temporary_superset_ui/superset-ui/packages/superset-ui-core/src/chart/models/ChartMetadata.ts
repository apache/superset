import { Behavior } from '../types/Base';

interface LookupTable {
  [key: string]: boolean;
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
  exampleGallery?: string[];
  tags?: string[];
  categories?: string[];
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

  exampleGallery: string[];

  tags: string[];

  categories: string[];

  constructor(config: ChartMetadataConfig) {
    const {
      name,
      canBeAnnotationTypes = [],
      credits = [],
      description = '',
      show = true,
      supportedAnnotationTypes = [],
      thumbnail,
      useLegacyApi = false,
      behaviors = [],
      datasourceCount = 1,
      enableNoResults = true,
      deprecated = false,
      exampleGallery = [],
      tags = [],
      categories = [],
    } = config;

    this.name = name;
    this.credits = credits;
    this.description = description;
    this.show = show;
    this.canBeAnnotationTypes = canBeAnnotationTypes;
    this.canBeAnnotationTypesLookup = canBeAnnotationTypes.reduce(
      (prev: LookupTable, type: string) => {
        const lookup = prev;
        lookup[type] = true;

        return lookup;
      },
      {},
    );
    this.supportedAnnotationTypes = supportedAnnotationTypes;
    this.thumbnail = thumbnail;
    this.useLegacyApi = useLegacyApi;
    this.behaviors = behaviors;
    this.datasourceCount = datasourceCount;
    this.enableNoResults = enableNoResults;
    this.deprecated = deprecated;
    this.exampleGallery = exampleGallery;
    this.tags = tags;
    this.categories = categories;
  }

  canBeAnnotationType(type: string): boolean {
    return this.canBeAnnotationTypesLookup[type] || false;
  }

  clone() {
    return new ChartMetadata(this);
  }
}
