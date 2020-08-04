// Compare two objects, partial deep equal
export function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  // TODO - implement deep equal on view descriptors
  return Object.keys(a).every(key => {
    if (Array.isArray(a[key]) && Array.isArray(b[key])) {
      return deepEqual(a[key], b[key]);
    }
    return a[key] === b[key];
  });
}
