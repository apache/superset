/**
 * From https://stackoverflow.com/questions/36871299/how-to-extend-function-with-es6-classes
 */

export default class ExtensibleFunction extends Function {
  constructor(fn: Function) {
    super();

    return Object.setPrototypeOf(fn, new.target.prototype);
  }
}
