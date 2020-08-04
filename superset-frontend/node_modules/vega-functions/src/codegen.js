import {
  codegen,
  constants,
  functions
} from 'vega-expression';

import {
  isTuple
} from 'vega-dataflow';

import {
  selectionResolve,
  selectionTest,
  selectionVisitor
} from 'vega-selections';

import {
  cumulativeLogNormal,
  cumulativeNormal,
  cumulativeUniform,
  densityLogNormal,
  densityNormal,
  densityUniform,
  quantileLogNormal,
  quantileNormal,
  quantileUniform,
  random,
  sampleLogNormal,
  sampleNormal,
  sampleUniform
} from 'vega-statistics';

import {
  dayofyear,
  timeOffset,
  timeSequence,
  timeUnitSpecifier,
  utcOffset,
  utcSequence,
  utcdayofyear,
  utcweek,
  week
} from 'vega-time';

import {
  clampRange,
  extend,
  extent,
  flush,
  inrange,
  isArray,
  isBoolean,
  isDate,
  isNumber,
  isObject,
  isRegExp,
  isString,
  lerp,
  pad,
  panLinear,
  panLog,
  panPow,
  panSymlog,
  peek,
  quarter,
  span,
  stringValue,
  toBoolean,
  toDate,
  toNumber,
  toString,
  truncate,
  utcquarter,
  zoomLinear,
  zoomLog,
  zoomPow,
  zoomSymlog
} from 'vega-util';

import {
  range as sequence
} from 'd3-array';

import {
  hcl,
  hsl,
  lab,
  rgb
} from 'd3-color';

import {
  contrast,
  luminance
} from './functions/luminance';

import {
  data,
  indata,
  setdata
} from './functions/data';

import encode from './functions/encode';

import {
  dayAbbrevFormat,
  dayFormat,
  format,
  monthAbbrevFormat,
  monthFormat,
  timeFormat,
  timeParse,
  utcFormat,
  utcParse
} from './functions/format';

import {
  geoArea,
  geoBounds,
  geoCentroid
} from './functions/geo';

import inScope from './functions/inscope';

import intersect from './functions/intersect';

import {
  debug,
  info,
  warn
} from './functions/log';

import merge from './functions/merge';

import modify from './functions/modify';

import {
  pinchAngle,
  pinchDistance
} from './functions/pinch';

import {
  bandspace,
  bandwidth,
  copy,
  domain,
  invert,
  range,
  scale
} from './functions/scale';

import scaleGradient from './functions/scale-gradient';

import {
  geoShape,
  pathShape
} from './functions/shape';

import {
  treeAncestors,
  treePath
} from './functions/tree';

import {
  containerSize,
  screen,
  windowSize
} from './functions/window';

import {
  SignalPrefix
} from './constants';

import {
  internalScaleFunctions
} from './scales';

import {
  dataVisitor,
  indataVisitor,
  scaleVisitor
} from './visitors';

// Expression function context object
export const functionContext = {
  random: function() { return random(); }, // override default
  cumulativeNormal,
  cumulativeLogNormal,
  cumulativeUniform,
  densityNormal,
  densityLogNormal,
  densityUniform,
  quantileNormal,
  quantileLogNormal,
  quantileUniform,
  sampleNormal,
  sampleLogNormal,
  sampleUniform,
  isArray,
  isBoolean,
  isDate,
  isDefined: function(_) { return _ !== undefined; },
  isNumber,
  isObject,
  isRegExp,
  isString,
  isTuple,
  isValid: function(_) { return _ != null && _ === _; },
  toBoolean,
  toDate,
  toNumber,
  toString,
  flush,
  lerp,
  merge,
  pad,
  peek,
  span,
  inrange,
  truncate,
  rgb,
  lab,
  hcl,
  hsl,
  luminance,
  contrast,
  sequence,
  format,
  utcFormat,
  utcParse,
  utcOffset,
  utcSequence,
  timeFormat,
  timeParse,
  timeOffset,
  timeSequence,
  timeUnitSpecifier,
  monthFormat,
  monthAbbrevFormat,
  dayFormat,
  dayAbbrevFormat,
  quarter,
  utcquarter,
  week,
  utcweek,
  dayofyear,
  utcdayofyear,
  warn,
  info,
  debug,
  extent,
  inScope,
  intersect,
  clampRange,
  pinchDistance,
  pinchAngle,
  screen,
  containerSize,
  windowSize,
  bandspace,
  setdata,
  pathShape,
  panLinear,
  panLog,
  panPow,
  panSymlog,
  zoomLinear,
  zoomLog,
  zoomPow,
  zoomSymlog,
  encode,
  modify
};

const eventFunctions = ['view', 'item', 'group', 'xy', 'x', 'y'], // event functions
      eventPrefix = 'event.vega.', // event function prefix
      thisPrefix = 'this.', // function context prefix
      astVisitors = {}; // AST visitors for dependency analysis

// Build expression function registry
function buildFunctions(codegen) {
  const fn = functions(codegen);
  eventFunctions.forEach(name => fn[name] = eventPrefix + name);
  for (let name in functionContext) { fn[name] = thisPrefix + name; }
  extend(fn, internalScaleFunctions(codegen, functionContext, astVisitors));
  return fn;
}

// Register an expression function
export function expressionFunction(name, fn, visitor) {
  if (arguments.length === 1) {
    return functionContext[name];
  }

  // register with the functionContext
  functionContext[name] = fn;

  // if there is an astVisitor register that, too
  if (visitor) astVisitors[name] = visitor;

  // if the code generator has already been initialized,
  // we need to also register the function with it
  if (codeGenerator) codeGenerator.functions[name] = thisPrefix + name;
  return this;
}

// register expression functions with ast visitors
expressionFunction('bandwidth', bandwidth, scaleVisitor);
expressionFunction('copy', copy, scaleVisitor);
expressionFunction('domain', domain, scaleVisitor);
expressionFunction('range', range, scaleVisitor);
expressionFunction('invert', invert, scaleVisitor);
expressionFunction('scale', scale, scaleVisitor);
expressionFunction('gradient', scaleGradient, scaleVisitor);
expressionFunction('geoArea', geoArea, scaleVisitor);
expressionFunction('geoBounds', geoBounds, scaleVisitor);
expressionFunction('geoCentroid', geoCentroid, scaleVisitor);
expressionFunction('geoShape', geoShape, scaleVisitor);
expressionFunction('indata', indata, indataVisitor);
expressionFunction('data', data, dataVisitor);
expressionFunction('treePath', treePath, dataVisitor);
expressionFunction('treeAncestors', treeAncestors, dataVisitor);

// register Vega-Lite selection functions
expressionFunction('vlSelectionTest', selectionTest, selectionVisitor);
expressionFunction('vlSelectionResolve', selectionResolve, selectionVisitor);

// Export code generator and parameters
export const codegenParams = {
  blacklist:  ['_'],
  whitelist:  ['datum', 'event', 'item'],
  fieldvar:   'datum',
  globalvar:  id => '_[' + stringValue(SignalPrefix + id) + ']',
  functions:  buildFunctions,
  constants:  constants,
  visitors:   astVisitors
};

export var codeGenerator = codegen(codegenParams);
