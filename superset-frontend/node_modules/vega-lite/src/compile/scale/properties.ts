import {isArray} from 'vega-util';
import {isBinned, isBinning, isBinParams} from '../../bin';
import {Channel, COLOR, FILL, ScaleChannel, STROKE, X, Y} from '../../channel';
import {ScaleFieldDef, TypedFieldDef} from '../../channeldef';
import {Config} from '../../config';
import * as log from '../../log';
import {Mark, MarkDef, RectConfig} from '../../mark';
import {
  channelScalePropertyIncompatability,
  Domain,
  hasContinuousDomain,
  isContinuousToContinuous,
  isContinuousToDiscrete,
  NiceTime,
  Scale,
  ScaleConfig,
  ScaleType,
  scaleTypeSupportProperty
} from '../../scale';
import {Sort} from '../../sort';
import {Type} from '../../type';
import * as util from '../../util';
import {contains, getFirstDefined, keys} from '../../util';
import {VgScale} from '../../vega.schema';
import {getBinSignalName} from '../data/bin';
import {isUnitModel, Model} from '../model';
import {Explicit, mergeValuesWithExplicit, tieBreakByComparing} from '../split';
import {UnitModel} from '../unit';
import {SignalRefWrapper} from './../signal';
import {ScaleComponentIndex, ScaleComponentProps} from './component';
import {parseUnitScaleRange} from './range';

export function parseScaleProperty(model: Model, property: keyof (Scale | ScaleComponentProps)) {
  if (isUnitModel(model)) {
    parseUnitScaleProperty(model, property);
  } else {
    parseNonUnitScaleProperty(model, property);
  }
}

function parseUnitScaleProperty(model: UnitModel, property: keyof (Scale | ScaleComponentProps)) {
  const localScaleComponents: ScaleComponentIndex = model.component.scales;

  keys(localScaleComponents).forEach((channel: ScaleChannel) => {
    const specifiedScale = model.specifiedScales[channel];
    const localScaleCmpt = localScaleComponents[channel];
    const mergedScaleCmpt = model.getScaleComponent(channel);
    const fieldDef = model.fieldDef(channel);
    const config = model.config;

    const specifiedValue = specifiedScale[property];
    const sType = mergedScaleCmpt.get('type');

    const supportedByScaleType = scaleTypeSupportProperty(sType, property);
    const channelIncompatability = channelScalePropertyIncompatability(channel, property);

    if (specifiedValue !== undefined) {
      // If there is a specified value, check if it is compatible with scale type and channel
      if (!supportedByScaleType) {
        log.warn(log.message.scalePropertyNotWorkWithScaleType(sType, property, channel));
      } else if (channelIncompatability) {
        // channel
        log.warn(channelIncompatability);
      }
    }
    if (supportedByScaleType && channelIncompatability === undefined) {
      if (specifiedValue !== undefined) {
        // copyKeyFromObject ensures type safety
        localScaleCmpt.copyKeyFromObject(property, specifiedScale);
      } else {
        const value = getDefaultValue(
          property,
          model,
          channel,
          fieldDef,
          mergedScaleCmpt.get('type'),
          mergedScaleCmpt.get('padding'),
          mergedScaleCmpt.get('paddingInner'),
          specifiedScale.domain,
          model.markDef,
          config
        );
        if (value !== undefined) {
          localScaleCmpt.set(property, value, false);
        }
      }
    }
  });
}

// Note: This method is used in Voyager.
export function getDefaultValue(
  property: keyof Scale,
  model: Model,
  channel: Channel,
  fieldDef: ScaleFieldDef<string, Type>,
  scaleType: ScaleType,
  scalePadding: number,
  scalePaddingInner: number,
  specifiedDomain: Scale['domain'],
  markDef: MarkDef,
  config: Config
) {
  const scaleConfig = config.scale;
  const {type, sort} = fieldDef;

  // If we have default rule-base, determine default value first
  switch (property) {
    case 'bins':
      return bins(model, fieldDef);
    case 'interpolate':
      return interpolate(channel, type);
    case 'nice':
      return nice(scaleType, channel, fieldDef);
    case 'padding':
      return padding(channel, scaleType, scaleConfig, fieldDef, markDef, config.bar);
    case 'paddingInner':
      return paddingInner(scalePadding, channel, markDef.type, scaleConfig);
    case 'paddingOuter':
      return paddingOuter(scalePadding, channel, scaleType, markDef.type, scalePaddingInner, scaleConfig);
    case 'reverse':
      return reverse(scaleType, sort);
    case 'zero':
      return zero(channel, fieldDef, specifiedDomain, markDef, scaleType);
  }
  // Otherwise, use scale config
  return scaleConfig[property];
}

// This method is here rather than in range.ts to avoid circular dependency.
export function parseScaleRange(model: Model) {
  if (isUnitModel(model)) {
    parseUnitScaleRange(model);
  } else {
    parseNonUnitScaleProperty(model, 'range');
  }
}

export function parseNonUnitScaleProperty(model: Model, property: keyof (Scale | ScaleComponentProps)) {
  const localScaleComponents: ScaleComponentIndex = model.component.scales;

  for (const child of model.children) {
    if (property === 'range') {
      parseScaleRange(child);
    } else {
      parseScaleProperty(child, property);
    }
  }

  keys(localScaleComponents).forEach((channel: ScaleChannel) => {
    let valueWithExplicit: Explicit<any>;

    for (const child of model.children) {
      const childComponent = child.component.scales[channel];
      if (childComponent) {
        const childValueWithExplicit = childComponent.getWithExplicit(property);
        valueWithExplicit = mergeValuesWithExplicit<VgScale, any>(
          valueWithExplicit,
          childValueWithExplicit,
          property,
          'scale',
          tieBreakByComparing<VgScale, any>((v1, v2) => {
            switch (property) {
              case 'range':
                // For step, prefer larger step
                if (v1.step && v2.step) {
                  return v1.step - v2.step;
                }
                return 0;
              // TODO: precedence rule for other properties
            }
            return 0;
          })
        );
      }
    }
    localScaleComponents[channel].setWithExplicit(property, valueWithExplicit);
  });
}

export function bins(model: Model, fieldDef: TypedFieldDef<string>) {
  const bin = fieldDef.bin;
  if (isBinning(bin)) {
    const binSignal = getBinSignalName(model, fieldDef.field, bin);
    return new SignalRefWrapper(() => {
      return model.getSignalName(binSignal);
    });
  } else if (isBinned(bin) && isBinParams(bin) && bin.step !== undefined) {
    // start and stop will be determined from the scale domain
    return {
      step: bin.step
    };
  }
  return undefined;
}

export function interpolate(channel: Channel, type: Type) {
  if (contains([COLOR, FILL, STROKE], channel) && type !== 'nominal') {
    return 'hcl';
  }
  return undefined;
}

export function nice(scaleType: ScaleType, channel: Channel, fieldDef: TypedFieldDef<string>): boolean | NiceTime {
  if (fieldDef.bin || util.contains([ScaleType.TIME, ScaleType.UTC], scaleType)) {
    return undefined;
  }
  return util.contains([X, Y], channel) ? true : undefined;
}

export function padding(
  channel: Channel,
  scaleType: ScaleType,
  scaleConfig: ScaleConfig,
  fieldDef: TypedFieldDef<string>,
  markDef: MarkDef,
  barConfig: RectConfig
) {
  if (util.contains([X, Y], channel)) {
    if (isContinuousToContinuous(scaleType)) {
      if (scaleConfig.continuousPadding !== undefined) {
        return scaleConfig.continuousPadding;
      }

      const {type, orient} = markDef;
      if (type === 'bar' && !fieldDef.bin && !fieldDef.timeUnit) {
        if ((orient === 'vertical' && channel === 'x') || (orient === 'horizontal' && channel === 'y')) {
          return barConfig.continuousBandSize;
        }
      }
    }

    if (scaleType === ScaleType.POINT) {
      return scaleConfig.pointPadding;
    }
  }
  return undefined;
}

export function paddingInner(paddingValue: number, channel: Channel, mark: Mark, scaleConfig: ScaleConfig) {
  if (paddingValue !== undefined) {
    // If user has already manually specified "padding", no need to add default paddingInner.
    return undefined;
  }

  if (util.contains([X, Y], channel)) {
    // Padding is only set for X and Y by default.
    // Basically it doesn't make sense to add padding for color and size.

    // paddingOuter would only be called if it's a band scale, just return the default for bandScale.

    const {bandPaddingInner, barBandPaddingInner, rectBandPaddingInner} = scaleConfig;

    return getFirstDefined(bandPaddingInner, mark === 'bar' ? barBandPaddingInner : rectBandPaddingInner);
  }
  return undefined;
}

export function paddingOuter(
  paddingValue: number,
  channel: Channel,
  scaleType: ScaleType,
  mark: Mark,
  paddingInnerValue: number,
  scaleConfig: ScaleConfig
) {
  if (paddingValue !== undefined) {
    // If user has already manually specified "padding", no need to add default paddingOuter.
    return undefined;
  }

  if (util.contains([X, Y], channel)) {
    // Padding is only set for X and Y by default.
    // Basically it doesn't make sense to add padding for color and size.
    if (scaleType === ScaleType.BAND) {
      const {bandPaddingOuter} = scaleConfig;

      return getFirstDefined(
        bandPaddingOuter,
        /* By default, paddingOuter is paddingInner / 2. The reason is that
          size (width/height) = step * (cardinality - paddingInner + 2 * paddingOuter).
          and we want the width/height to be integer by default.
          Note that step (by default) and cardinality are integers.) */
        paddingInnerValue / 2
      );
    }
  }
  return undefined;
}

export function reverse(scaleType: ScaleType, sort: Sort<string>) {
  if (hasContinuousDomain(scaleType) && sort === 'descending') {
    // For continuous domain scales, Vega does not support domain sort.
    // Thus, we reverse range instead if sort is descending
    return true;
  }
  return undefined;
}

export function zero(
  channel: Channel,
  fieldDef: TypedFieldDef<string>,
  specifiedDomain: Domain,
  markDef: MarkDef,
  scaleType: ScaleType
) {
  // If users explicitly provide a domain range, we should not augment zero as that will be unexpected.
  const hasCustomDomain = !!specifiedDomain && specifiedDomain !== 'unaggregated';
  if (hasCustomDomain) {
    if (hasContinuousDomain(scaleType)) {
      if (isArray(specifiedDomain)) {
        const first = specifiedDomain[0];
        const last = specifiedDomain[specifiedDomain.length - 1];

        if (first <= 0 && last >= 0) {
          // if the domain includes zero, make zero remains true
          return true;
        }
      }
      return false;
    }
  }

  // If there is no custom domain, return true only for the following cases:

  // 1) using quantitative field with size
  // While this can be either ratio or interval fields, our assumption is that
  // ratio are more common. However, if the scaleType is discretizing scale, we want to return
  // false so that range doesn't start at zero
  if (channel === 'size' && fieldDef.type === 'quantitative' && !isContinuousToDiscrete(scaleType)) {
    return true;
  }

  // 2) non-binned, quantitative x-scale or y-scale
  // (For binning, we should not include zero by default because binning are calculated without zero.)
  if (!fieldDef.bin && util.contains([X, Y], channel)) {
    const {orient, type} = markDef;
    if (contains(['bar', 'area', 'line', 'trail'], type)) {
      if ((orient === 'horizontal' && channel === 'y') || (orient === 'vertical' && channel === 'x')) {
        return false;
      }
    }

    return true;
  }
  return false;
}
