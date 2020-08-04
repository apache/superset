import * as log from '../../../log';
import {contains, getFirstDefined} from '../../../util';
import {VgEncodeEntry} from '../../../vega.schema';
import {getMarkConfig} from '../../common';
import {UnitModel} from '../../unit';
import {nonPosition} from './nonposition';

export function color(model: UnitModel): VgEncodeEntry {
  const {markDef, encoding, config} = model;
  const {filled, type: markType} = markDef;

  const configValue = {
    fill: getMarkConfig('fill', markDef, config),
    stroke: getMarkConfig('stroke', markDef, config),
    color: getMarkConfig('color', markDef, config)
  };

  const transparentIfNeeded = contains(['bar', 'point', 'circle', 'square', 'geoshape'], markType)
    ? 'transparent'
    : undefined;

  const defaultFill = getFirstDefined(
    markDef.fill,
    filled === true ? markDef.color : undefined,
    configValue.fill,
    filled === true ? configValue.color : undefined,
    // If there is no fill, always fill symbols, bar, geoshape
    // with transparent fills https://github.com/vega/vega-lite/issues/1316
    transparentIfNeeded
  );

  const defaultStroke = getFirstDefined(
    markDef.stroke,
    filled === false ? markDef.color : undefined,
    configValue.stroke,
    filled === false ? configValue.color : undefined
  );

  const colorVgChannel = filled ? 'fill' : 'stroke';

  const fillStrokeMarkDefAndConfig: VgEncodeEntry = {
    ...(defaultFill ? {fill: {value: defaultFill}} : {}),
    ...(defaultStroke ? {stroke: {value: defaultStroke}} : {})
  };

  if (markDef.color && (filled ? markDef.fill : markDef.stroke)) {
    log.warn(log.message.droppingColor('property', {fill: 'fill' in markDef, stroke: 'stroke' in markDef}));
  }

  return {
    ...fillStrokeMarkDefAndConfig,
    ...nonPosition('color', model, {
      vgChannel: colorVgChannel,
      defaultValue: filled ? defaultFill : defaultStroke
    }),
    ...nonPosition('fill', model, {
      // if there is encoding.fill, include default fill just in case we have conditional-only fill encoding
      defaultValue: encoding.fill ? defaultFill : undefined
    }),
    ...nonPosition('stroke', model, {
      // if there is encoding.stroke, include default fill just in case we have conditional-only stroke encoding
      defaultValue: encoding.stroke ? defaultStroke : undefined
    })
  };
}
