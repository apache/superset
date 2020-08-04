import {area} from '../path/shapes';
import {pickArea} from '../util/pickPath';
import markMultiItemPath from './markMultiItemPath';

export default markMultiItemPath('area', area, pickArea);
