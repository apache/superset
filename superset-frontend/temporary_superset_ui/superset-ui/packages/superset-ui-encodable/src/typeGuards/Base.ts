export function isArray<T>(maybeArray: T | T[]): maybeArray is T[] {
  return Array.isArray(maybeArray);
}

export function isNotArray<T>(maybeArray: T | T[]): maybeArray is T {
  return !Array.isArray(maybeArray);
}

export function isDefined<T>(value: any): value is T {
  return typeof value !== 'undefined' && value !== null;
}
