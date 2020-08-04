// @flow
const EPSILON = 1e-7;

// Returns true if value is either an array or a typed array
function isArray(value: any): boolean {
  return Array.isArray(value) || ArrayBuffer.isView(value);
}

// TODO: use math.gl
export function equals(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }
  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; ++i) {
      if (!equals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  return Math.abs(a - b) <= EPSILON;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Interpolate between two numbers or two arrays
export function lerp(a: any, b: any, t: number): any {
  if (isArray(a)) {
    return a.map((ai, i) => lerp(ai, b[i], t));
  }
  return t * b + (1 - t) * a;
}
