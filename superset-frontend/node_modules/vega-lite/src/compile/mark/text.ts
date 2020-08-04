import {Config} from '../../config';
import {Encoding} from '../../encoding';
import {MarkDef} from '../../mark';
import {getMarkConfig} from '../common';
import {UnitModel} from '../unit';
import {MarkCompiler} from './base';
import * as encode from './encode';

export const text: MarkCompiler = {
  vgMark: 'text',

  encodeEntry: (model: UnitModel) => {
    const {config, encoding} = model;

    return {
      ...encode.baseEncodeEntry(model, {
        align: 'include',
        baseline: 'include',
        color: 'include',
        size: 'ignore',
        orient: 'ignore'
      }),
      ...encode.pointPosition('x', model, {defaultPos: 'mid'}),
      ...encode.pointPosition('y', model, {defaultPos: 'mid'}),
      ...encode.text(model),
      ...encode.nonPosition('size', model, {
        vgChannel: 'fontSize' // VL's text size is fontSize
      }),
      ...encode.valueIfDefined('align', align(model.markDef, encoding, config)),
      ...encode.valueIfDefined('baseline', baseline(model.markDef, encoding, config))
    };
  }
};

function align(markDef: MarkDef, encoding: Encoding<string>, config: Config) {
  const a = markDef.align ?? getMarkConfig('align', markDef, config);
  if (a === undefined) {
    return 'center';
  }
  // If there is a config, Vega-parser will process this already.
  return undefined;
}

function baseline(markDef: MarkDef, encoding: Encoding<string>, config: Config) {
  const b = markDef.baseline ?? getMarkConfig('baseline', markDef, config);
  if (b === undefined) {
    return 'middle';
  }
  // If there is a config, Vega-parser will process this already.
  return undefined;
}
