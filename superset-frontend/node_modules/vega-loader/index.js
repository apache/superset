import loaderFactory from './src/loader';

export var loader = loaderFactory(
  require('node-fetch'),
  require('fs')
);

export {
  default as read
} from './src/read';

export {
  inferType,
  inferTypes,
  typeParsers
} from './src/type';

export {
  format,
  formats,
  responseType
} from './src/formats/index';
