import {UnitModel} from '../unit';
import {MarkCompiler} from './base';
import * as encode from './encode';

export const rule: MarkCompiler = {
  vgMark: 'rule',
  encodeEntry: (model: UnitModel) => {
    const {markDef} = model;
    const orient = markDef.orient;

    if (!model.encoding.x && !model.encoding.y && !model.encoding.latitude && !model.encoding.longitude) {
      // Show nothing if we have none of x, y, lat, and long.
      return {};
    }

    return {
      ...encode.baseEncodeEntry(model, {
        align: 'ignore',
        baseline: 'ignore',
        color: 'include',
        orient: 'ignore',
        size: 'ignore'
      }),
      ...encode.pointOrRangePosition('x', model, {
        defaultPos: orient === 'horizontal' ? 'zeroOrMin' : 'mid',
        defaultPos2: 'zeroOrMax',
        range: orient !== 'vertical' // include x2 for horizontal or line segment rule
      }),
      ...encode.pointOrRangePosition('y', model, {
        defaultPos: orient === 'vertical' ? 'zeroOrMin' : 'mid',
        defaultPos2: 'zeroOrMax',
        range: orient !== 'horizontal' // include y2 for vertical or line segment rule
      }),
      ...encode.nonPosition('size', model, {
        vgChannel: 'strokeWidth' // VL's rule size is strokeWidth
      })
    };
  }
};
