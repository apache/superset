export default class VizDataStore {
  constructor(...args) {
    this.data = null;
    this.formData = {};
    this.outdated = false;
    this.update(...args);
  }

  update(...args) {
    Object.assign(this, ...args);
  }
}
