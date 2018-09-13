export default class ChartVariation {
  constructor({
    key,
    metadata,
    defaultParams,
  } = {}) {
    this.parent = null;
    this.key = key;
    this.metadata = metadata;
    this.defaultParams = defaultParams;
  }

  setParent(parent) {
    this.parent = parent;
  }
}
