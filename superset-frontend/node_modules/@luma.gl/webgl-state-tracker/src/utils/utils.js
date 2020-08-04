// Returns true if given object is empty, false otherwise.
export function isObjectEmpty(object) {
  for (const key in object) {
    return false;
  }
  return true;
}

// Returns true if WebGL2 context (Heuristic)
export function isWebGL2(gl) {
  return Boolean(gl && gl._version === 2);
}
