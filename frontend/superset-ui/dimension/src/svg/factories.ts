import LazyFactory from './LazyFactory';
import createHiddenSvgNode from './createHiddenSvgNode';
import createTextNode from './createTextNode';

export const hiddenSvgFactory = new LazyFactory(createHiddenSvgNode);
export const textFactory = new LazyFactory(createTextNode);
