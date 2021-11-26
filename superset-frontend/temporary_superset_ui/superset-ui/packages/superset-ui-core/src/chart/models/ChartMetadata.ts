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
  show?: boolean;
  supportedAnnotationTypes?: string[];
  thumbnail: string;
  useLegacyApi?: boolean;
  behaviors?: Behavior[];
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
  }

  canBeAnnotationType(type: string): boolean {
    return this.canBeAnnotationTypesLookup[type] || false;
  }

  clone() {
    return new ChartMetadata({
      canBeAnnotationTypes: this.canBeAnnotationTypes,
      credits: this.credits,
      description: this.description,
      name: this.name,
      show: this.show,
      supportedAnnotationTypes: this.supportedAnnotationTypes,
      thumbnail: this.thumbnail,
      useLegacyApi: this.useLegacyApi,
      behaviors: this.behaviors,
      datasourceCount: this.datasourceCount,
    });
  }
}
