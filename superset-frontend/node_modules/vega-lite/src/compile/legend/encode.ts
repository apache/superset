import {ColorValueRef, SymbolEncodeEntry} from 'vega';
import {isArray, stringValue, array} from 'vega-util';
import {COLOR, NonPositionScaleChannel, OPACITY} from '../../channel';
import {
  Conditional,
  FieldDefWithCondition,
  Gradient,
  hasConditionalValueDef,
  isTimeFormatFieldDef,
  isValueDef,
  MarkPropFieldDef,
  TypedFieldDef,
  Value,
  ValueDef,
  ValueDefWithCondition
} from '../../channeldef';
import {FILL_STROKE_CONFIG} from '../../mark';
import {ScaleType} from '../../scale';
import {getFirstDefined, keys, varName} from '../../util';
import {applyMarkConfig, timeFormatExpression} from '../common';
import * as mixins from '../mark/encode';
import {STORE} from '../selection';
import {UnitModel} from '../unit';
import {ScaleChannel} from './../../channel';
import {LegendComponent} from './component';
import {defaultType} from './properties';
import {normalizeTimeUnit} from '../../timeunit';

function type(legendCmp: LegendComponent, model: UnitModel, channel: ScaleChannel) {
  const scaleType = model.getScaleComponent(channel).get('type');
  return getFirstDefined(legendCmp.get('type'), defaultType({channel, scaleType, alwaysReturn: true}));
}

export function symbols(
  fieldDef: TypedFieldDef<string>,
  symbolsSpec: any,
  model: UnitModel,
  channel: ScaleChannel,
  legendCmp: LegendComponent
): SymbolEncodeEntry {
  if (type(legendCmp, model, channel) !== 'symbol') {
    return undefined;
  }

  let out = {
    ...applyMarkConfig({}, model, FILL_STROKE_CONFIG),
    ...mixins.color(model)
  } as SymbolEncodeEntry; // FIXME: remove this when VgEncodeEntry is compatible with SymbolEncodeEntry

  const {markDef, encoding, config} = model;
  const filled = markDef.filled;

  const opacity = getMaxValue(encoding.opacity) ?? markDef.opacity;
  const condition = selectedCondition(model, legendCmp, fieldDef);

  if (out.fill) {
    // for fill legend, we don't want any fill in symbol
    if (channel === 'fill' || (filled && channel === COLOR)) {
      delete out.fill;
    } else {
      if (out.fill['field']) {
        // For others, set fill to some opaque value (or nothing if a color is already set)
        if (legendCmp.get('symbolFillColor')) {
          delete out.fill;
        } else {
          out.fill = {value: config.legend.symbolBaseFillColor ?? 'black'};
          out.fillOpacity = {value: opacity ?? 1};
        }
      } else if (isArray(out.fill)) {
        const fill =
          getFirstConditionValue(encoding.fill ?? encoding.color) ?? markDef.fill ?? (filled && markDef.color);
        if (fill) {
          out.fill = {value: fill} as ColorValueRef;
        }
      }
    }
  }

  if (out.stroke) {
    if (channel === 'stroke' || (!filled && channel === COLOR)) {
      delete out.stroke;
    } else {
      if (out.stroke['field']) {
        // For others, remove stroke field
        delete out.stroke;
      } else if (isArray(out.stroke)) {
        const stroke = getFirstDefined(
          getFirstConditionValue(encoding.stroke || encoding.color),
          markDef.stroke,
          filled ? markDef.color : undefined
        );
        if (stroke) {
          out.stroke = {value: stroke} as ColorValueRef;
        }
      }
    }
  }

  if (channel !== OPACITY) {
    if (condition) {
      out.opacity = [{test: condition, value: opacity ?? 1}, {value: config.legend.unselectedOpacity}];
    } else if (opacity) {
      out.opacity = {value: opacity};
    }
  }

  out = {...out, ...symbolsSpec};

  return keys(out).length > 0 ? out : undefined;
}

export function gradient(
  fieldDef: TypedFieldDef<string>,
  gradientSpec: any,
  model: UnitModel,
  channel: ScaleChannel,
  legendCmp: LegendComponent
) {
  if (type(legendCmp, model, channel) !== 'gradient') {
    return undefined;
  }

  let out: SymbolEncodeEntry = {};

  const opacity = getMaxValue(model.encoding.opacity) || model.markDef.opacity;
  if (opacity) {
    // only apply opacity if it is neither zero or undefined
    out.opacity = {value: opacity};
  }

  out = {...out, ...gradientSpec};
  return keys(out).length > 0 ? out : undefined;
}

export function labels(
  fieldDef: TypedFieldDef<string>,
  labelsSpec: any,
  model: UnitModel,
  channel: NonPositionScaleChannel,
  legendCmp: LegendComponent
) {
  const legend = model.legend(channel);
  const config = model.config;
  const condition = selectedCondition(model, legendCmp, fieldDef);

  let out: SymbolEncodeEntry = {};

  if (isTimeFormatFieldDef(fieldDef)) {
    const isUTCScale = model.getScaleComponent(channel).get('type') === ScaleType.UTC;
    const expr = timeFormatExpression(
      'datum.value',
      normalizeTimeUnit(fieldDef.timeUnit)?.unit,
      legend.format,
      config.timeFormat,
      isUTCScale
    );
    labelsSpec = {
      ...(expr ? {text: {signal: expr}} : {}),
      ...labelsSpec
    };
  }

  if (condition) {
    labelsSpec.opacity = [{test: condition, value: 1}, {value: config.legend.unselectedOpacity}];
  }

  out = {...out, ...labelsSpec};

  return keys(out).length > 0 ? out : undefined;
}

export function entries(
  fieldDef: TypedFieldDef<string>,
  entriesSpec: any,
  model: UnitModel,
  channel: NonPositionScaleChannel,
  legendCmp: LegendComponent
) {
  const selections = legendCmp.get('selections');
  return selections?.length ? {fill: {value: 'transparent'}} : undefined;
}

function getMaxValue(
  channelDef:
    | FieldDefWithCondition<MarkPropFieldDef<string>, number>
    | ValueDefWithCondition<MarkPropFieldDef<string>, number>
) {
  return getConditionValue<number>(channelDef, (v: number, conditionalDef) => Math.max(v, conditionalDef.value as any));
}

export function getFirstConditionValue<V extends Value | Gradient>(
  channelDef: FieldDefWithCondition<MarkPropFieldDef<string>, V> | ValueDefWithCondition<MarkPropFieldDef<string>, V>
): V {
  return getConditionValue(channelDef, (v: V, conditionalDef: Conditional<ValueDef<V>>) => {
    return getFirstDefined<V>(v, conditionalDef.value);
  });
}

function getConditionValue<V extends Value | Gradient>(
  channelDef: FieldDefWithCondition<MarkPropFieldDef<string>, V> | ValueDefWithCondition<MarkPropFieldDef<string>, V>,
  reducer: (val: V, conditionalDef: Conditional<ValueDef<V>>) => V
): V {
  if (hasConditionalValueDef(channelDef)) {
    return array(channelDef.condition).reduce(reducer, channelDef.value as any);
  } else if (isValueDef(channelDef)) {
    return channelDef.value as any;
  }
  return undefined;
}

function selectedCondition(model: UnitModel, legendCmp: LegendComponent, fieldDef: TypedFieldDef<string>) {
  const selections = legendCmp.get('selections');
  if (!selections?.length) return undefined;

  const field = stringValue(fieldDef.field);
  return selections
    .map(name => {
      const store = stringValue(varName(name) + STORE);
      return `(!length(data(${store})) || (${name}[${field}] && indexof(${name}[${field}], datum.value) >= 0))`;
    })
    .join(' || ');
}
