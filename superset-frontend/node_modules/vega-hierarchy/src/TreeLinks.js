import {Transform, ingest, tupleid} from 'vega-dataflow';
import {error, inherits} from 'vega-util';

 /**
  * Generate tuples representing links between tree nodes.
  * The resulting tuples will contain 'source' and 'target' fields,
  * which point to parent and child node tuples, respectively.
  * @constructor
  * @param {object} params - The parameters for this operator.
  */
export default function TreeLinks(params) {
  Transform.call(this, [], params);
}

TreeLinks.Definition = {
  'type': 'TreeLinks',
  'metadata': {'tree': true, 'generates': true, 'changes': true},
  'params': []
};

var prototype = inherits(TreeLinks, Transform);

prototype.transform = function(_, pulse) {
  var links = this.value,
      tree = pulse.source && pulse.source.root,
      out = pulse.fork(pulse.NO_SOURCE),
      lut = {};

  if (!tree) error('TreeLinks transform requires a tree data source.');

  if (pulse.changed(pulse.ADD_REM)) {
    // remove previous links
    out.rem = links;

    // build lookup table of valid tuples
    pulse.visit(pulse.SOURCE, function(t) { lut[tupleid(t)] = 1; });

    // generate links for all edges incident on valid tuples
    tree.each(function(node) {
      var t = node.data,
          p = node.parent && node.parent.data;
      if (p && lut[tupleid(t)] && lut[tupleid(p)]) {
        out.add.push(ingest({source: p, target: t}));
      }
    });
    this.value = out.add;
  }

  else if (pulse.changed(pulse.MOD)) {
    // build lookup table of modified tuples
    pulse.visit(pulse.MOD, function(t) { lut[tupleid(t)] = 1; });

    // gather links incident on modified tuples
    links.forEach(function(link) {
      if (lut[tupleid(link.source)] || lut[tupleid(link.target)]) {
        out.mod.push(link);
      }
    });
  }

  return out;
};
