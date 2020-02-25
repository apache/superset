import { CategoricalColorNamespace, CategoricalColorScale } from '@superset-ui/color';
import {
  ScaleOrdinal,
  ScaleLinear,
  ScaleLogarithmic,
  ScalePower,
  ScaleTime,
  ScaleQuantile,
  ScaleQuantize,
  ScaleThreshold,
  ScalePoint,
  ScaleBand,
  scaleLinear,
  scaleLog,
  scalePow,
  scaleSqrt,
  scaleTime,
  scaleUtc,
  scaleQuantile,
  scaleQuantize,
  scaleThreshold,
  scaleOrdinal,
  scalePoint,
  scaleBand,
} from 'd3-scale';
import { Value } from 'vega-lite/build/src/channeldef';
import { Type } from 'vega-lite/build/src/type';
import { ScaleType } from 'vega-lite/build/src/scale';
import {
  isNonValueDef,
  ChannelDef,
  ExtractChannelOutput,
  isTypedFieldDef,
} from '../types/ChannelDef';
import isDisabled from '../utils/isDisabled';
import { ChannelType } from '../types/Channel';
import { Scale } from '../types/Scale';

export interface ScaleAgent<Output extends Value> {
  config: Scale<Output>;
  setDomain: (newDomain: number[] | string[] | boolean[] | Date[]) => void;
  encodeValue: (value: number | string | boolean | null | undefined | Date) => Output;
  scale:
    | CategoricalColorScale
    | ScaleLinear<Output, Output>
    | ScaleLogarithmic<Output, Output>
    | ScalePower<Output, Output>
    | ScaleLogarithmic<Output, Output>
    | ScaleTime<Output, Output>
    | ScaleQuantile<Output>
    | ScaleQuantize<Output>
    | ScaleThreshold<number | string | Date, Output>
    | ScaleOrdinal<{ toString(): string }, Output>
    | ScalePoint<{ toString(): string }>
    | ScaleBand<{ toString(): string }>;
  scaleTypeCategory: 'continuous' | 'discrete' | 'discretizing' | undefined;
}

export interface ScaleTypeToD3ScaleType<Output> {
  [ScaleType.LINEAR]: ScaleLinear<Output, Output>;
  [ScaleType.LOG]: ScaleLogarithmic<Output, Output>;
  [ScaleType.POW]: ScalePower<Output, Output>;
  [ScaleType.SQRT]: ScalePower<Output, Output>;
  [ScaleType.SYMLOG]: ScaleLogarithmic<Output, Output>;
  [ScaleType.TIME]: ScaleTime<Output, Output>;
  [ScaleType.UTC]: ScaleTime<Output, Output>;
  [ScaleType.QUANTILE]: ScaleQuantile<Output>;
  [ScaleType.QUANTIZE]: ScaleQuantize<Output>;
  [ScaleType.THRESHOLD]: ScaleThreshold<number | string | Date, Output>;
  [ScaleType.BIN_ORDINAL]: ScaleOrdinal<{ toString(): string }, Output>;
  [ScaleType.ORDINAL]: ScaleOrdinal<{ toString(): string }, Output>;
  [ScaleType.POINT]: ScalePoint<{ toString(): string }>;
  [ScaleType.BAND]: ScaleBand<{ toString(): string }>;
}

export function deriveScaleTypeFromDataTypeAndChannelType(
  dataType: Type | undefined,
  channelType: ChannelType,
  isBinned: boolean = false,
): ScaleType | undefined {
  if (typeof dataType === 'undefined') {
    return undefined;
  }
  if (dataType === 'nominal' || dataType === 'ordinal') {
    switch (channelType) {
      // For positional (x and y) ordinal and ordinal fields,
      // "point" is the default scale type for all marks
      // except bar and rect marks, which use "band" scales.
      // https://vega.github.io/vega-lite/docs/scale.html
      case 'XBand':
      case 'YBand':
        return ScaleType.BAND;
      case 'X':
      case 'Y':
      case 'Numeric':
        return ScaleType.POINT;
      case 'Color':
      case 'Category':
        return ScaleType.ORDINAL;
      default:
    }
  } else if (dataType === 'quantitative') {
    switch (channelType) {
      case 'XBand':
      case 'YBand':
      case 'X':
      case 'Y':
      case 'Numeric':
        return ScaleType.LINEAR;
      case 'Color':
        return isBinned ? ScaleType.LINEAR : ScaleType.BIN_ORDINAL;
      default:
    }
  } else if (dataType === 'temporal') {
    switch (channelType) {
      case 'XBand':
      case 'YBand':
      case 'X':
      case 'Y':
      case 'Numeric':
        return ScaleType.TIME;
      case 'Color':
        return ScaleType.LINEAR;
      default:
    }
  }

  return undefined;
}

function createScaleFromType<Output>(type: ScaleType) {
  switch (type) {
    case ScaleType.LINEAR:
      return scaleLinear<Output>();
    case ScaleType.LOG:
      return scaleLog<Output>();
    case ScaleType.POW:
      return scalePow<Output>();
    case ScaleType.SQRT:
      return scaleSqrt<Output>();
    case ScaleType.SYMLOG:
      return undefined;
    case ScaleType.TIME:
      return scaleTime<Output>();
    case ScaleType.UTC:
      return scaleUtc<Output>();
    case ScaleType.QUANTILE:
      return scaleQuantile<Output>();
    case ScaleType.QUANTIZE:
      return scaleQuantize<Output>();
    case ScaleType.THRESHOLD:
      return scaleThreshold<number | string | Date, Output>();
    case ScaleType.BIN_ORDINAL:
      return scaleOrdinal<{ toString(): string }, Output>();
    case ScaleType.ORDINAL:
      return scaleOrdinal<{ toString(): string }, Output>();
    case ScaleType.POINT:
      return scalePoint<{ toString(): string }>();
    case ScaleType.BAND:
      return scaleBand<{ toString(): string }>();
    default:
      return undefined;
  }
}

function createScale<Output extends Value>(
  channelType: ChannelType,
  scaleType: ScaleType,
  config: Scale<Output>,
) {
  const { namespace } = config;

  if (channelType === 'Color') {
    const { scheme } = config;

    return typeof scheme === 'string' || typeof scheme === 'undefined'
      ? CategoricalColorNamespace.getScale(scheme, namespace)
      : // TODO: fully use SchemeParams
        CategoricalColorNamespace.getScale(scheme.name, namespace);
  }

  const scale = createScaleFromType<Output>(scaleType);

  if (typeof scale !== 'undefined') {
    if (scale.domain && typeof config.domain !== 'undefined') {
      scale.domain(config.domain as any[]);
    }
    if (scale.range && typeof config.range !== 'undefined') {
      scale.range(config.range as any[]);
    }
    if ('nice' in scale && scale.nice && config.nice !== false) {
      scale.nice();
    }
    if (
      'clamp' in scale &&
      typeof scale.clamp !== 'undefined' &&
      typeof config.clamp !== 'undefined'
    ) {
      scale.clamp(config.clamp);
    }
  }

  return scale;
}

const continuousScaleTypes = new Set(['linear', 'pow', 'sqrt', 'symlog', 'log', 'time', 'utc']);
const discreteScaleTypes = new Set(['band', 'point', 'ordinal']);
const discretizingScaleTypes = new Set(['bin-ordinal', 'quantile', 'quantize', 'threshold']);

function getScaleTypeCategory(scaleType: ScaleType) {
  if (continuousScaleTypes.has(scaleType)) {
    return 'continuous';
  }
  if (discreteScaleTypes.has(scaleType)) {
    return 'discrete';
  }
  if (discretizingScaleTypes.has(scaleType)) {
    return 'discretizing';
  }

  // eslint-disable-next-line no-console
  console.warn(`Unknown scaleType ${scaleType}`);

  return undefined;
}

export default function extractScale<Def extends ChannelDef>(
  channelType: ChannelType,
  definition: Def,
  namespace?: string,
): ScaleAgent<ExtractChannelOutput<Def>> | undefined {
  if (isNonValueDef(definition)) {
    type Output = ExtractChannelOutput<Def>;
    const scaleConfig: Scale<Output> = ('scale' in definition &&
    typeof definition.scale !== 'undefined'
      ? definition.scale
      : {}) as Scale<Output>;

    // return if scale is disabled
    if (isDisabled(scaleConfig)) {
      return undefined;
    }

    let scaleType = scaleConfig.type;

    if (typeof scaleType === 'undefined') {
      // If scale type is not defined, try to derive scale type from field type
      const dataType = isTypedFieldDef(definition) ? definition.type : undefined;
      scaleType = deriveScaleTypeFromDataTypeAndChannelType(dataType, channelType);

      // If still do not have scale type, cannot create scale
      if (typeof scaleType === 'undefined') {
        return undefined;
      }
    }

    const scale = createScale<Output>(channelType, scaleType, {
      namespace,
      ...scaleConfig,
    });

    if (scale) {
      const setDomain =
        scale instanceof CategoricalColorScale || typeof scale.domain === 'undefined'
          ? () => {}
          : scale.domain;

      return {
        config: { ...scaleConfig, type: scaleType },
        encodeValue: (scale as unknown) as (
          value: number | string | boolean | null | undefined | Date,
        ) => Output,
        scale,
        scaleTypeCategory: getScaleTypeCategory(scaleType),
        setDomain,
      };
    }
  }

  // ValueDef does not have scale
  return undefined;
}
