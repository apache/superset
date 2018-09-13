export default class ChartMetadata {
  constructor({
    name,
    description,
    thumbnail,
    show = true,
  }) {
    this.name = name;
    this.description = description;
    this.thumbnail = thumbnail;
    this.show = show;
    this.variations = [];
  }

  addVariation(variation) {
    variation.setParent(this);
    this.variations.push(variation);
    return this;
  }
}
