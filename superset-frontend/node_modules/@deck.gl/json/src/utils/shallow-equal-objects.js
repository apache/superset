// TODO - can we reuse the core util? Assuming we don't want to export it

/* eslint-disable complexity */

// Compares two objects to see if their keys are shallowly equal
export function shallowEqualObjects(a, b) {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }

  for (const key in a) {
    if (!(key in b) || a[key] !== b[key]) {
      return false;
    }
  }
  for (const key in b) {
    if (!(key in a)) {
      return false;
    }
  }
  return true;
}
