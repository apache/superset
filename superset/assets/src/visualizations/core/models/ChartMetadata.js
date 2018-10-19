export default class ChartMetadata {
  constructor({
    name,
    credits = [],
    description = '',
    show = true,
    canBeAnnotationTypes = [],
    supportedAnnotationTypes = [],
    thumbnail,
  }) {
    this.name = name;
    this.credits = credits;
    this.description = description;
    this.show = show;
    this.canBeAnnotationTypesLookup = canBeAnnotationTypes.reduce((prev, type) => {
      const lookup = prev;
      lookup[type] = true;
      return lookup;
    }, {});
    this.supportedAnnotationTypes = supportedAnnotationTypes;
    this.thumbnail = thumbnail;
  }

  canBeAnnotationType(type) {
    return this.canBeAnnotationTypesLookup[type] || false;
  }
}
