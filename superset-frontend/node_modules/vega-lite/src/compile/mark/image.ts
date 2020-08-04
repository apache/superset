import {UnitModel} from '../unit';
import {MarkCompiler} from './base';
import * as encode from './encode';

export const image: MarkCompiler = {
  vgMark: 'image',
  encodeEntry: (model: UnitModel) => {
    return {
      ...encode.baseEncodeEntry(model, {
        align: 'ignore',
        baseline: 'ignore',
        color: 'ignore',
        orient: 'ignore',
        size: 'ignore'
      }),
      ...encode.rectPosition(model, 'x', 'image'),
      ...encode.rectPosition(model, 'y', 'image'),
      ...encode.text(model, 'url')
    };
  }
};
