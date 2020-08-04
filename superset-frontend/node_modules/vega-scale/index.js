export {
  default as bandSpace
} from './src/scales/bandSpace';

export {
  Identity,
  Linear,
  Log,
  Pow,
  Sqrt,
  Symlog,
  Time,
  UTC,
  Sequential,
  Diverging,
  Quantile,
  Quantize,
  Threshold,
  BinOrdinal,
  Ordinal,
  Band,
  Point
} from './src/scales/types';

export {
  interpolate,
  interpolateColors,
  interpolateRange,
  scaleCopy,
  scaleFraction,
  quantizeInterpolator
} from './src/interpolate';

export {
  scale,
  isValidScaleType,
  isContinuous,
  isDiscrete,
  isDiscretizing,
  isInterpolating,
  isLogarithmic,
  isQuantile,
  isTemporal
} from './src/scales';

export {
  scheme
} from './src/schemes';

export {
  SymbolLegend,
  DiscreteLegend,
  GradientLegend
} from './src/legend-types';

export {
  tickCount,
  tickFormat,
  tickValues,
  validTicks
} from './src/ticks';

export {
  labelFormat,
  labelFraction,
  labelValues
} from './src/labels';

export {
  domainCaption
} from './src/caption';

export {
  scaleImplicit
} from 'd3-scale';
