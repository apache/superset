// lib
export * from './lib/common';

// classes
export {default as Vector2} from './classes/vector2';
export {default as Vector3} from './classes/vector3';
export {default as Vector4} from './classes/vector4';
export {default as Matrix3} from './classes/matrix3';
export {default as Matrix4} from './classes/matrix4';
export {default as Quaternion} from './classes/quaternion';

// extras

// export {checkNumber} from './lib/validators';
export function assert(condition: boolean, message?: string): void;

// experimental
export {default as _Polygon} from './addons/polygon';
export {default as _SphericalCoordinates} from './classes/spherical-coordinates';
export {default as _Pose} from './classes/pose';
export {default as _Euler} from './classes/euler';

export const _MathUtils: {
  EPSILON1: number;
  EPSILON2: number;
  EPSILON3: number;
  EPSILON4: number;
  EPSILON5: number;
  EPSILON6: number;
  EPSILON7: number;
  EPSILON8: number;
  EPSILON9: number;
  EPSILON10: number;
  EPSILON11: number;
  EPSILON12: number;
  EPSILON13: number;
  EPSILON14: number;
  EPSILON15: number;
  EPSILON16: number;
  EPSILON17: number;
  EPSILON18: number;
  EPSILON19: number;
  EPSILON20: number;

  PI_OVER_TWO: number;
  PI_OVER_FOUR: number;
  PI_OVER_SIX: number;

  TWO_PI: number;
};
