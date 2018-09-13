export default class ChartVariationMetadata {
  constructor({
    variationKey,
    name,
    description,
    thumbnail,
    show = true,
    defaultParams,
  } = {}) {
    this.parent = null;
    this.variationKey = variationKey;
    this.name = name;
    this.description = description;
    this.thumbnail = thumbnail;
    this.show = show;
    this.defaultParams = defaultParams;
  }

  setParent(parent) {
    this.parent = parent;
  }
}
