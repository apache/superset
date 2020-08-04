import {Transform} from 'vega-dataflow';
import {inherits} from 'vega-util';

/**
 * Queue modified scenegraph items for rendering.
 * @constructor
 */
export default function Render(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(Render, Transform);

prototype.transform = function(_, pulse) {
  var view = pulse.dataflow;

  pulse.visit(pulse.ALL, item => view.dirty(item));

  // set z-index dirty flag as needed
  if (pulse.fields && pulse.fields['zindex']) {
    var item = pulse.source && pulse.source[0];
    if (item) item.mark.zdirty = true;
  }
};
