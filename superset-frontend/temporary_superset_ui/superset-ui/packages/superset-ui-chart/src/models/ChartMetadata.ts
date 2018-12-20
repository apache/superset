interface LookupTable {
  [key: string]: boolean;
}

export interface ChartMetadataConfig {
  name: string;
  credits?: Array<string>;
  description?: string;
  show?: boolean;
  canBeAnnotationTypes?: Array<string>;
  supportedAnnotationTypes?: Array<string>;
  thumbnail: string;
}

export default class ChartMetadata {
  name: string;
  credits: Array<string>;
  description: string;
  show: boolean;
  canBeAnnotationTypesLookup: LookupTable;
  supportedAnnotationTypes: Array<string>;
  thumbnail: string;

  constructor(config: ChartMetadataConfig) {
    const {
      name,
      credits = [],
      description = '',
      show = true,
      canBeAnnotationTypes = [],
      supportedAnnotationTypes = [],
      thumbnail,
    } = config;

    this.name = name;
    this.credits = credits;
    this.description = description;
    this.show = show;
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
  }

  canBeAnnotationType(type: string): boolean {
    return this.canBeAnnotationTypesLookup[type] || false;
  }
}
