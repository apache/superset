import {transforms} from 'vega-dataflow';
import {functionContext} from 'vega-functions';
import {context} from 'vega-runtime';

export default function(view, spec, expr) {
  return context(view, transforms, functionContext, expr).parse(spec);
}
