
/** Base class for vectors and matrices */
export default class MathArray<DerivedType> extends Array<number> {
  // Defined by derived class
  ELEMENTS: number;
  RANK: number;

  clone(): DerivedType;

  // TODO - define more sophisticated object type per class?
  from(array: readonly number[]): DerivedType;
  from(object: object): DerivedType;

  fromArray(array: readonly number[], offset?: number): DerivedType;
  // todo
  to(arrayOrObject): any;
  toTarget(target): any;

  toArray(array?: number[], offset?: number): number[];
  toFloat32Array(): Float32Array;
  toString(): string;
  formatString(opts: object): string;
  equals(array: readonly number[]): boolean;
  exactEquals(array: readonly number[]): boolean;

  // Modifiers

  negate(): DerivedType;
  lerp(a: readonly number[], b: readonly number[], t: number): DerivedType;

  min(vector: readonly number[]): DerivedType;
  max(vector: readonly number[]): DerivedType;

  clamp(minVector: readonly number[], maxVector: readonly number[]): DerivedType;

  add(...vectors): DerivedType;
  subtract(...vectors): DerivedType;

  scale(scale): DerivedType;

  // three.js compatibility

  sub(a): DerivedType;
  setScalar(a): DerivedType;
  addScalar(a): DerivedType;
  subScalar(a): DerivedType;
  multiplyScalar(scalar): DerivedType;
  divideScalar(a): DerivedType;
  clampScalar(min, max): DerivedType;
  elements: number[];

  // Cesium compatibility
  multiplyByScalar(scalar): DerivedType;

  // private
  check(): DerivedType;
}
