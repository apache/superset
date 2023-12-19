// eslint-disable-next-line no-underscore-dangle
const PREFIX = (window as any).__SUPERSET_DEPLOYMENT_PREFIX__ ?? '';
export const withPrefix = (path: string): string => `${PREFIX}${path}`;
