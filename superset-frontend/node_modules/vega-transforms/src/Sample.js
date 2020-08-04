import {Transform, tupleid} from 'vega-dataflow';
import {random} from 'vega-statistics';
import {inherits} from 'vega-util';

/**
 * Samples tuples passing through this operator.
 * Uses reservoir sampling to maintain a representative sample.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {number} [params.size=1000] - The maximum number of samples.
 */
export default function Sample(params) {
  Transform.call(this, [], params);
  this.count = 0;
}

Sample.Definition = {
  'type': 'Sample',
  'metadata': {},
  'params': [
    { 'name': 'size', 'type': 'number', 'default': 1000 }
  ]
};

var prototype = inherits(Sample, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.NO_SOURCE),
      mod = _.modified('size'),
      num = _.size,
      res = this.value,
      cnt = this.count,
      cap = 0,
      map = res.reduce(function(m, t) {
        m[tupleid(t)] = 1;
        return m;
      }, {});

  // sample reservoir update function
  function update(t) {
    var p, idx;

    if (res.length < num) {
      res.push(t);
    } else {
      idx = ~~((cnt + 1) * random());
      if (idx < res.length && idx >= cap) {
        p = res[idx];
        if (map[tupleid(p)]) out.rem.push(p); // eviction
        res[idx] = t;
      }
    }
    ++cnt;
  }

  if (pulse.rem.length) {
    // find all tuples that should be removed, add to output
    pulse.visit(pulse.REM, function(t) {
      var id = tupleid(t);
      if (map[id]) {
        map[id] = -1;
        out.rem.push(t);
      }
      --cnt;
    });

    // filter removed tuples out of the sample reservoir
    res = res.filter(function(t) { return map[tupleid(t)] !== -1; });
  }

  if ((pulse.rem.length || mod) && res.length < num && pulse.source) {
    // replenish sample if backing data source is available
    cap = cnt = res.length;
    pulse.visit(pulse.SOURCE, function(t) {
      // update, but skip previously sampled tuples
      if (!map[tupleid(t)]) update(t);
    });
    cap = -1;
  }

  if (mod && res.length > num) {
    for (var i=0, n=res.length-num; i<n; ++i) {
      map[tupleid(res[i])] = -1;
      out.rem.push(res[i]);
    }
    res = res.slice(n);
  }

  if (pulse.mod.length) {
    // propagate modified tuples in the sample reservoir
    pulse.visit(pulse.MOD, function(t) {
      if (map[tupleid(t)]) out.mod.push(t);
    });
  }

  if (pulse.add.length) {
    // update sample reservoir
    pulse.visit(pulse.ADD, update);
  }

  if (pulse.add.length || cap < 0) {
    // output newly added tuples
    out.add = res.filter(function(t) { return !map[tupleid(t)]; });
  }

  this.count = cnt;
  this.value = out.source = res;
  return out;
};
