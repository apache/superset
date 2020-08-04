export default class Geometry extends Array {
  clone() {
    return new this.constructor().copy(this).check();
  }

  check() {
    return this;
  }
}
