import {UnitModel} from '../unit';
import {MarkCompiler} from './base';
import * as encode from './encode';

export const line: MarkCompiler = {
  vgMark: 'line',
  encodeEntry: (model: UnitModel) => {
    return {
      ...encode.baseEncodeEntry(model, {
        align: 'ignore',
        baseline: 'ignore',
        color: 'include',
        size: 'ignore',
        orient: 'ignore'
      }),
      ...encode.pointPosition('x', model, {defaultPos: 'mid'}),
      ...encode.pointPosition('y', model, {defaultPos: 'mid'}),
      ...encode.nonPosition('size', model, {
        vgChannel: 'strokeWidth' // VL's line size is strokeWidth
      }),
      ...encode.defined(model)
    };
  }
};

export const trail: MarkCompiler = {
  vgMark: 'trail',
  encodeEntry: (model: UnitModel) => {
    return {
      ...encode.baseEncodeEntry(model, {
        align: 'ignore',
        baseline: 'ignore',
        color: 'include',
        size: 'include',
        orient: 'ignore'
      }),
      ...encode.pointPosition('x', model, {defaultPos: 'mid'}),
      ...encode.pointPosition('y', model, {defaultPos: 'mid'}),
      ...encode.nonPosition('size', model),
      ...encode.defined(model)
    };
  }
};
