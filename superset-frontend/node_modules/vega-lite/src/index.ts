import pkg from '../package.json';
import {normalize} from './normalize';

const version = pkg.version;

export {compile} from './compile/compile';
export {Config} from './config';
export {TopLevelSpec} from './spec';
export {extractTransforms} from './transformextract';
export {normalize, version};
