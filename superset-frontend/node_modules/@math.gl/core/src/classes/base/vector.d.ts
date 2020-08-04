import MathArray from './math-array';

/** Base class for vectors */
export default class Vector<VectorType> extends MathArray<VectorType> {
  // VIRTUAL METHODS
  // copy(vector) {

  // ACCESSORS

  x: number;
  y: number;

  // NOTE: `length` is a reserved word for Arrays, so we can't use `v.length()`
  len(): number;
  magnitude(): number;
  lengthSquared(): number;
  magnitudeSquared(): number;

  distance(mathArray): number;

  distanceSquared(mathArray): number;

  dot(mathArray): number;
  // MODIFIERS

  normalize(): VectorType;

  multiply(...vectors): VectorType;

  divide(...vectors): VectorType;

  // THREE.js compatibility
  lengthSq(): number;
  distanceTo(vector: VectorType): number;
  distanceToSquared(vector): number;

  getComponent(i): number;
  setComponent(i, value): number;

  addVectors(a: VectorType, b: VectorType): VectorType;
  subVectors(a: VectorType, b: VectorType): VectorType;
  multiplyVectors(a: VectorType, b: VectorType): VectorType;

  addScaledVector(a: VectorType, b: VectorType): VectorType;
}
