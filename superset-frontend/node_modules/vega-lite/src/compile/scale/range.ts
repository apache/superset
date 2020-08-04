import {RangeScheme, SignalRef} from 'vega';
import {isArray, isNumber} from 'vega-util';
import {isBinning} from '../../bin';
import {
  Channel,
  COLOR,
  FILL,
  FILLOPACITY,
  OPACITY,
  ScaleChannel,
  SCALE_CHANNELS,
  SHAPE,
  SIZE,
  STROKE,
  STROKEOPACITY,
  STROKEWIDTH,
  X,
  Y
} from '../../channel';
import {Config, getViewConfigDiscreteSize, getViewConfigDiscreteStep, ViewConfig} from '../../config';
import * as log from '../../log';
import {Mark} from '../../mark';
import {
  channelScalePropertyIncompatability,
  Domain,
  hasContinuousDomain,
  hasDiscreteDomain,
  isContinuousToDiscrete,
  isExtendedScheme,
  Scale,
  scaleTypeSupportProperty,
  Scheme
} from '../../scale';
import {isStep, LayoutSizeMixins} from '../../spec/base';
import * as util from '../../util';
import {isSignalRef, VgRange} from '../../vega.schema';
import {getBinSignalName} from '../data/bin';
import {SignalRefWrapper} from '../signal';
import {Explicit, makeExplicit, makeImplicit} from '../split';
import {UnitModel} from '../unit';
import {ScaleComponentIndex} from './component';

export const RANGE_PROPERTIES: (keyof Scale)[] = ['range', 'scheme'];

function getSizeType(channel: ScaleChannel) {
  return channel === 'x' ? 'width' : channel === 'y' ? 'height' : undefined;
}

export function parseUnitScaleRange(model: UnitModel) {
  const localScaleComponents: ScaleComponentIndex = model.component.scales;

  // use SCALE_CHANNELS instead of scales[channel] to ensure that x, y come first!
  SCALE_CHANNELS.forEach((channel: ScaleChannel) => {
    const localScaleCmpt = localScaleComponents[channel];
    if (!localScaleCmpt) {
      return;
    }

    const rangeWithExplicit = parseRangeForChannel(channel, model);

    localScaleCmpt.setWithExplicit('range', rangeWithExplicit);
  });
}

function getBinStepSignal(model: UnitModel, channel: 'x' | 'y'): SignalRefWrapper {
  const fieldDef = model.fieldDef(channel);

  if (fieldDef && fieldDef.bin && isBinning(fieldDef.bin)) {
    const binSignal = getBinSignalName(model, fieldDef.field, fieldDef.bin);

    // TODO: extract this to be range step signal
    const sizeType = getSizeType(channel);
    const sizeSignal = model.getName(sizeType);
    return new SignalRefWrapper(() => {
      const updatedName = model.getSignalName(binSignal);
      const binCount = `(${updatedName}.stop - ${updatedName}.start) / ${updatedName}.step`;
      return `${model.getSignalName(sizeSignal)} / (${binCount})`;
    });
  }
  return undefined;
}

/**
 * Return mixins that includes one of the Vega range types (explicit range, range.step, range.scheme).
 */
export function parseRangeForChannel(channel: ScaleChannel, model: UnitModel): Explicit<VgRange> {
  const specifiedScale = model.specifiedScales[channel];
  const {size} = model;

  const mergedScaleCmpt = model.getScaleComponent(channel);
  const scaleType = mergedScaleCmpt.get('type');

  // Check if any of the range properties is specified.
  // If so, check if it is compatible and make sure that we only output one of the properties
  for (const property of RANGE_PROPERTIES) {
    if (specifiedScale[property] !== undefined) {
      const supportedByScaleType = scaleTypeSupportProperty(scaleType, property);
      const channelIncompatability = channelScalePropertyIncompatability(channel, property);
      if (!supportedByScaleType) {
        log.warn(log.message.scalePropertyNotWorkWithScaleType(scaleType, property, channel));
      } else if (channelIncompatability) {
        // channel
        log.warn(channelIncompatability);
      } else {
        switch (property) {
          case 'range':
            return makeExplicit(specifiedScale[property]);
          case 'scheme':
            return makeExplicit(parseScheme(specifiedScale[property]));
        }
      }
    }
  }

  if (channel === X || channel === Y) {
    const sizeChannel = channel === X ? 'width' : 'height';
    const sizeValue = size[sizeChannel];
    if (isStep(sizeValue)) {
      if (hasDiscreteDomain(scaleType)) {
        return makeExplicit({step: sizeValue.step});
      } else {
        log.warn(log.message.stepDropped(sizeChannel));
      }
    }
  }

  return makeImplicit(defaultRange(channel, model));
}

function parseScheme(scheme: Scheme): RangeScheme {
  if (isExtendedScheme(scheme)) {
    return {
      scheme: scheme.name,
      ...util.omit(scheme, ['name'])
    };
  }
  return {scheme: scheme};
}

function defaultRange(channel: ScaleChannel, model: UnitModel): VgRange {
  const {size, config, mark} = model;

  const getSignalName = model.getSignalName.bind(model);

  const {type} = model.fieldDef(channel);

  const mergedScaleCmpt = model.getScaleComponent(channel);
  const scaleType = mergedScaleCmpt.get('type');

  const {domain, domainMid} = model.specifiedScales[channel];

  switch (channel) {
    case X:
    case Y: {
      // If there is no explicit width/height for discrete x/y scales
      if (util.contains(['point', 'band'], scaleType)) {
        if (channel === X && !size.width) {
          const w = getViewConfigDiscreteSize(config.view, 'width');
          if (isStep(w)) {
            return w;
          }
        } else if (channel === Y && !size.height) {
          const h = getViewConfigDiscreteSize(config.view, 'height');
          if (isStep(h)) {
            return h;
          }
        }
      }

      // If step is null, use zero to width or height.
      // Note that these range signals are temporary
      // as they can be merged and renamed.
      // (We do not have the right size signal here since parseLayoutSize() happens after parseScale().)
      // We will later replace these temporary names with
      // the final name in assembleScaleRange()

      const sizeType = getSizeType(channel);
      const sizeSignal = model.getName(sizeType);

      if (channel === Y && hasContinuousDomain(scaleType)) {
        // For y continuous scale, we have to start from the height as the bottom part has the max value.
        return [SignalRefWrapper.fromName(getSignalName, sizeSignal), 0];
      } else {
        return [0, SignalRefWrapper.fromName(getSignalName, sizeSignal)];
      }
    }
    case SIZE: {
      // TODO: support custom rangeMin, rangeMax
      const zero = model.component.scales[channel].get('zero');
      const rangeMin = sizeRangeMin(mark, zero, config);
      const rangeMax = sizeRangeMax(mark, size, model, config);
      if (isContinuousToDiscrete(scaleType)) {
        return interpolateRange(
          rangeMin,
          rangeMax,
          defaultContinuousToDiscreteCount(scaleType, config, domain, channel)
        );
      } else {
        return [rangeMin, rangeMax];
      }
    }
    case STROKEWIDTH:
      // TODO: support custom rangeMin, rangeMax
      return [config.scale.minStrokeWidth, config.scale.maxStrokeWidth];
    case SHAPE:
      return 'symbol';
    case COLOR:
    case FILL:
    case STROKE:
      if (scaleType === 'ordinal') {
        // Only nominal data uses ordinal scale by default
        return type === 'nominal' ? 'category' : 'ordinal';
      } else {
        if (domainMid !== undefined) {
          return 'diverging';
        } else {
          return mark === 'rect' || mark === 'geoshape' ? 'heatmap' : 'ramp';
        }
      }
    case OPACITY:
    case FILLOPACITY:
    case STROKEOPACITY:
      // TODO: support custom rangeMin, rangeMax
      return [config.scale.minOpacity, config.scale.maxOpacity];
  }
  /* istanbul ignore next: should never reach here */
  throw new Error(`Scale range undefined for channel ${channel}`);
}

export function defaultContinuousToDiscreteCount(
  scaleType: 'quantile' | 'quantize' | 'threshold',
  config: Config,
  domain: Domain,
  channel: Channel
) {
  switch (scaleType) {
    case 'quantile':
      return config.scale.quantileCount;
    case 'quantize':
      return config.scale.quantizeCount;
    case 'threshold':
      if (domain !== undefined && isArray(domain)) {
        return domain.length + 1;
      } else {
        log.warn(log.message.domainRequiredForThresholdScale(channel));
        // default threshold boundaries for threshold scale since domain has cardinality of 2
        return 3;
      }
  }
}

/**
 * Returns the linear interpolation of the range according to the cardinality
 *
 * @param rangeMin start of the range
 * @param rangeMax end of the range
 * @param cardinality number of values in the output range
 */
export function interpolateRange(rangeMin: number, rangeMax: number | SignalRef, cardinality: number): SignalRef {
  // always return a signal since it's better to compute the sequence in Vega later
  const f = () => {
    const rMax = isSignalRef(rangeMax) ? rangeMax.signal : rangeMax;
    const step = `(${rMax} - ${rangeMin}) / (${cardinality} - 1)`;
    return `sequence(${rangeMin}, ${rangeMax} + ${step}, ${step})`;
  };
  if (isSignalRef(rangeMax)) {
    return new SignalRefWrapper(f);
  } else {
    return {signal: f()};
  }
}

function sizeRangeMin(mark: Mark, zero: boolean, config: Config) {
  if (zero) {
    return 0;
  }
  switch (mark) {
    case 'bar':
    case 'tick':
      return config.scale.minBandSize;
    case 'line':
    case 'trail':
    case 'rule':
      return config.scale.minStrokeWidth;
    case 'text':
      return config.scale.minFontSize;
    case 'point':
    case 'square':
    case 'circle':
      return config.scale.minSize;
  }
  /* istanbul ignore next: should never reach here */
  // sizeRangeMin not implemented for the mark
  throw new Error(log.message.incompatibleChannel('size', mark));
}

export const MAX_SIZE_RANGE_STEP_RATIO = 0.95;

function sizeRangeMax(mark: Mark, size: LayoutSizeMixins, model: UnitModel, config: Config): number | SignalRef {
  const xyStepSignals = {
    x: getBinStepSignal(model, 'x'),
    y: getBinStepSignal(model, 'y')
  };

  switch (mark) {
    case 'bar':
    case 'tick': {
      if (config.scale.maxBandSize !== undefined) {
        return config.scale.maxBandSize;
      }
      const min = minXYStep(size, xyStepSignals, config.view);

      if (isNumber(min)) {
        return min - 1;
      } else {
        return new SignalRefWrapper(() => `${min.signal} - 1`);
      }
    }
    case 'line':
    case 'trail':
    case 'rule':
      return config.scale.maxStrokeWidth;
    case 'text':
      return config.scale.maxFontSize;
    case 'point':
    case 'square':
    case 'circle': {
      if (config.scale.maxSize) {
        return config.scale.maxSize;
      }

      const pointStep = minXYStep(size, xyStepSignals, config.view);
      if (isNumber(pointStep)) {
        return Math.pow(MAX_SIZE_RANGE_STEP_RATIO * pointStep, 2);
      } else {
        return new SignalRefWrapper(() => `pow(${MAX_SIZE_RANGE_STEP_RATIO} * ${pointStep.signal}, 2)`);
      }
    }
  }
  /* istanbul ignore next: should never reach here */
  // sizeRangeMax not implemented for the mark
  throw new Error(log.message.incompatibleChannel('size', mark));
}

/**
 * @returns {number} Range step of x or y or minimum between the two if both are ordinal scale.
 */
function minXYStep(
  size: LayoutSizeMixins,
  xyStepSignals: {x?: SignalRefWrapper; y?: SignalRefWrapper},
  viewConfig: ViewConfig
): number | SignalRef {
  const widthStep = isStep(size.width) ? size.width.step : getViewConfigDiscreteStep(viewConfig, 'width');
  const heightStep = isStep(size.height) ? size.height.step : getViewConfigDiscreteStep(viewConfig, 'height');

  if (xyStepSignals.x || xyStepSignals.y) {
    return new SignalRefWrapper(() => {
      const exprs = [
        xyStepSignals.x ? xyStepSignals.x.signal : widthStep,
        xyStepSignals.y ? xyStepSignals.y.signal : heightStep
      ];
      return `min(${exprs.join(', ')})`;
    });
  }

  return Math.min(widthStep, heightStep);
}
