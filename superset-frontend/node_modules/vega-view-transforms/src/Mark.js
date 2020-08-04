import {Group} from './constants';
import {Transform} from 'vega-dataflow';
import {GroupItem, Item} from 'vega-scenegraph';
import {inherits} from 'vega-util';

/**
 * Bind scenegraph items to a scenegraph mark instance.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {object} params.markdef - The mark definition for creating the mark.
 *   This is an object of legal scenegraph mark properties which *must* include
 *   the 'marktype' property.
 */
export default function Mark(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(Mark, Transform);

prototype.transform = function(_, pulse) {
  var mark = this.value;

  // acquire mark on first invocation, bind context and group
  if (!mark) {
    mark = pulse.dataflow.scenegraph().mark(_.markdef, lookup(_), _.index);
    mark.group.context = _.context;
    if (!_.context.group) _.context.group = mark.group;
    mark.source = this.source; // point to upstream collector
    mark.clip = _.clip;
    mark.interactive = _.interactive;
    this.value = mark;
  }

  // initialize entering items
  var Init = mark.marktype === Group ? GroupItem : Item;
  pulse.visit(pulse.ADD, item => Init.call(item, mark));

  // update clipping and/or interactive status
  if (_.modified('clip') || _.modified('interactive')) {
    mark.clip = _.clip;
    mark.interactive = !!_.interactive;
    mark.zdirty = true; // force scenegraph re-eval
    pulse.reflow();
  }

  // bind items array to scenegraph mark
  mark.items = pulse.source;
  return pulse;
};

function lookup(_) {
  var g = _.groups, p = _.parent;
  return g && g.size === 1 ? g.get(Object.keys(g.object)[0])
    : g && p ? g.lookup(p)
    : null;
}
