import {line} from '../path/shapes';
import {pickLine} from '../util/pickPath';
import markMultiItemPath from './markMultiItemPath';

export default markMultiItemPath('line', line, pickLine);
