import parseSignalUpdates from './signal-updates';
import {initScale, parseScale} from './scale';
import parseProjection from './projection';
import parseLegend from './legend';
import parseSignal from './signal';
import parseTitle from './title';
import parseData from './data';
import parseMark from './mark';
import parseAxis from './axis';
import {array} from 'vega-util';

export default function(spec, scope, preprocessed) {
  var signals = array(spec.signals),
      scales = array(spec.scales);

  // parse signal definitions, if not already preprocessed
  if (!preprocessed) signals.forEach(_ => parseSignal(_, scope));

  // parse cartographic projection definitions
  array(spec.projections).forEach(_ => parseProjection(_, scope));

  // initialize scale references
  scales.forEach(_ => initScale(_, scope));

  // parse data sources
  array(spec.data).forEach(_ => parseData(_, scope));

  // parse scale definitions
  scales.forEach(_ => parseScale(_, scope));

  // parse signal updates
  (preprocessed || signals).forEach(_ => parseSignalUpdates(_, scope));

  // parse axis definitions
  array(spec.axes).forEach(_ => parseAxis(_, scope));

  // parse mark definitions
  array(spec.marks).forEach(_ => parseMark(_, scope));

  // parse legend definitions
  array(spec.legends).forEach(_ => parseLegend(_, scope));

  // parse title, if defined
  if (spec.title) parseTitle(spec.title, scope);

  // parse collected lambda (anonymous) expressions
  scope.parseLambdas();

  return scope;
}
