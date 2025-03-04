import { serializeValue } from './utils';

const APP_VERSION = serializeValue(process.env.APP_VERSION);
const ENVIRONMENT = serializeValue(process.env.env);
const TYPE = serializeValue(process.env.type);
const IS_UNAVAILABLE = serializeValue(process.env.isUnavailable) === 'true';

console.groupCollapsed('ENV file');
console.log('ENVIRONMENT', ENVIRONMENT);
console.log('TYPE', TYPE);
console.log('IS_UNAVAILABLE', IS_UNAVAILABLE);
console.groupEnd();

export { APP_VERSION };
