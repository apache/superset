interface LookupTable {
  [key: string]: boolean;
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

  constructor(config: {
    name: string;
    canBeAnnotationTypes?: string[];
    credits?: string[];
    description?: string;
    show?: boolean;
    supportedAnnotationTypes?: string[];
    thumbnail: string;
    useLegacyApi?: boolean;
  }) {
    const {
      name,
      canBeAnnotationTypes = [],
      credits = [],
      description = '',
      show = true,
      supportedAnnotationTypes = [],
      thumbnail,
      useLegacyApi = false,
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
    });
  }
}
