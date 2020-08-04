export function getLoaderContext(context, options) {
  return {
    fetch: typeof window !== 'undefined' && window.fetch,
    ...context
  };
}
