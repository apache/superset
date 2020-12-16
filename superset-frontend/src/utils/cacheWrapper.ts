export const cacheWrapper = <T extends Array<any>, U>(
  fn: (...args: T) => U,
  cache: Map<string, any>,
  keyFn: (...args: T) => string = (...args: T) => JSON.stringify([...args]),
) => {
  return (...args: T): U => {
    const key = keyFn(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};
