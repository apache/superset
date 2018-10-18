export default class ChartMetadata {
  constructor({
    name,
    credits = [],
    description = '',
    show = true,
    canBeAnnotation = [],
    supportedAnnotations = [],
    thumbnail,
  }) {
    this.name = name;
    this.credits = credits;
    this.description = description;
    this.show = show;
    this.canBeAnnotation = canBeAnnotation.reduce((prev, type) => {
      const lookup = prev;
      lookup[type] = true;
      return lookup;
    }, {});
    this.supportedAnnotations = supportedAnnotations;
    this.thumbnail = thumbnail;
  }
}
