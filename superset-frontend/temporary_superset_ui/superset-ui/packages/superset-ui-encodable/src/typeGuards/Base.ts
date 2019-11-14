export function isArray<T>(maybeArray: T | T[]): maybeArray is T[] {
  return Array.isArray(maybeArray);
}

export function isNotArray<T>(maybeArray: T | T[]): maybeArray is T {
  return !Array.isArray(maybeArray);
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return typeof value !== 'undefined' && value !== null;
}

export function isEveryElementDefined<T>(array: T[]): array is Exclude<T, undefined | null>[] {
  return array.every(isDefined);
}
