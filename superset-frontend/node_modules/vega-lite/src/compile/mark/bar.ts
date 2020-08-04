import {UnitModel} from '../unit';
import {MarkCompiler} from './base';
import * as encode from './encode';

export const bar: MarkCompiler = {
  vgMark: 'rect',
  encodeEntry: (model: UnitModel) => {
    return {
      ...encode.baseEncodeEntry(model, {
        align: 'ignore',
        baseline: 'ignore',
        color: 'include',
        orient: 'ignore',
        size: 'ignore'
      }),
      ...encode.rectPosition(model, 'x', 'bar'),
      ...encode.rectPosition(model, 'y', 'bar')
    };
  }
};
