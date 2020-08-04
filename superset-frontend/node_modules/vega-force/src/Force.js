import {Transform} from 'vega-dataflow';
import {
  accessorFields, array, error, hasOwnProperty,
  inherits, isFunction
} from 'vega-util';
import {
  forceCenter, forceCollide, forceLink,
  forceManyBody, forceSimulation, forceX, forceY
} from 'd3-force';

var ForceMap = {
  center: forceCenter,
  collide: forceCollide,
  nbody: forceManyBody,
  link: forceLink,
  x: forceX,
  y: forceY
};

var Forces = 'forces',
    ForceParams = [
      'alpha', 'alphaMin', 'alphaTarget',
      'velocityDecay', 'forces'
    ],
    ForceConfig = ['static', 'iterations'],
    ForceOutput = ['x', 'y', 'vx', 'vy'];

/**
 * Force simulation layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<object>} params.forces - The forces to apply.
 */
export default function Force(params) {
  Transform.call(this, null, params);
}

Force.Definition = {
  'type': 'Force',
  'metadata': {'modifies': true},
  'params': [
    { 'name': 'static', 'type': 'boolean', 'default': false },
    { 'name': 'restart', 'type': 'boolean', 'default': false },
    { 'name': 'iterations', 'type': 'number', 'default': 300 },
    { 'name': 'alpha', 'type': 'number', 'default': 1 },
    { 'name': 'alphaMin', 'type': 'number', 'default': 0.001 },
    { 'name': 'alphaTarget', 'type': 'number', 'default': 0 },
    { 'name': 'velocityDecay', 'type': 'number', 'default': 0.4 },
    { 'name': 'forces', 'type': 'param', 'array': true,
      'params': [
        {
          'key': {'force': 'center'},
          'params': [
            { 'name': 'x', 'type': 'number', 'default': 0 },
            { 'name': 'y', 'type': 'number', 'default': 0 }
          ]
        },
        {
          'key': {'force': 'collide'},
          'params': [
            { 'name': 'radius', 'type': 'number', 'expr': true },
            { 'name': 'strength', 'type': 'number', 'default': 0.7 },
            { 'name': 'iterations', 'type': 'number', 'default': 1 }
          ]
        },
        {
          'key': {'force': 'nbody'},
          'params': [
            { 'name': 'strength', 'type': 'number', 'default': -30 },
            { 'name': 'theta', 'type': 'number', 'default': 0.9 },
            { 'name': 'distanceMin', 'type': 'number', 'default': 1 },
            { 'name': 'distanceMax', 'type': 'number' }
          ]
        },
        {
          'key': {'force': 'link'},
          'params': [
            { 'name': 'links', 'type': 'data' },
            { 'name': 'id', 'type': 'field' },
            { 'name': 'distance', 'type': 'number', 'default': 30, 'expr': true },
            { 'name': 'strength', 'type': 'number', 'expr': true },
            { 'name': 'iterations', 'type': 'number', 'default': 1 }
          ]
        },
        {
          'key': {'force': 'x'},
          'params': [
            { 'name': 'strength', 'type': 'number', 'default': 0.1 },
            { 'name': 'x', 'type': 'field' }
          ]
        },
        {
          'key': {'force': 'y'},
          'params': [
            { 'name': 'strength', 'type': 'number', 'default': 0.1 },
            { 'name': 'y', 'type': 'field' }
          ]
        }
      ] },
    {
      'name': 'as', 'type': 'string', 'array': true, 'modify': false,
      'default': ForceOutput
    }
  ]
};

var prototype = inherits(Force, Transform);

prototype.transform = function(_, pulse) {
  var sim = this.value,
      change = pulse.changed(pulse.ADD_REM),
      params = _.modified(ForceParams),
      iters = _.iterations || 300;

  // configure simulation
  if (!sim) {
    this.value = sim = simulation(pulse.source, _);
    sim.on('tick', rerun(pulse.dataflow, this));
    if (!_.static) {
      change = true;
      sim.tick(); // ensure we run on init
    }
    pulse.modifies('index');
  } else {
    if (change) {
      pulse.modifies('index');
      sim.nodes(pulse.source);
    }
    if (params || pulse.changed(pulse.MOD)) {
      setup(sim, _, 0, pulse);
    }
  }

  // run simulation
  if (params || change || _.modified(ForceConfig)
      || (pulse.changed() && _.restart))
  {
    sim.alpha(Math.max(sim.alpha(), _.alpha || 1))
       .alphaDecay(1 - Math.pow(sim.alphaMin(), 1 / iters));

    if (_.static) {
      for (sim.stop(); --iters >= 0;) sim.tick();
    } else {
      if (sim.stopped()) sim.restart();
      if (!change) return pulse.StopPropagation; // defer to sim ticks
    }
  }

  return this.finish(_, pulse);
};

prototype.finish = function(_, pulse) {
  var dataflow = pulse.dataflow;

  // inspect dependencies, touch link source data
  for (var args=this._argops, j=0, m=args.length, arg; j<m; ++j) {
    arg = args[j];
    if (arg.name !== Forces || arg.op._argval.force !== 'link') {
      continue;
    }
    for (var ops=arg.op._argops, i=0, n=ops.length, op; i<n; ++i) {
      if (ops[i].name === 'links' && (op = ops[i].op.source)) {
        dataflow.pulse(op, dataflow.changeset().reflow());
        break;
      }
    }
  }

  // reflow all nodes
  return pulse.reflow(_.modified()).modifies(ForceOutput);
};

function rerun(df, op) {
  return function() { df.touch(op).run(); };
}

function simulation(nodes, _) {
  var sim = forceSimulation(nodes),
      stopped = false,
      stop = sim.stop,
      restart = sim.restart;

  sim.stopped = function() {
    return stopped;
  };
  sim.restart = function() {
    stopped = false;
    return restart();
  };
  sim.stop = function() {
    stopped = true;
    return stop();
  };

  return setup(sim, _, true).on('end', function() { stopped = true; });
}

function setup(sim, _, init, pulse) {
  var f = array(_.forces), i, n, p, name;

  for (i=0, n=ForceParams.length; i<n; ++i) {
    p = ForceParams[i];
    if (p !== Forces && _.modified(p)) sim[p](_[p]);
  }

  for (i=0, n=f.length; i<n; ++i) {
    name = Forces + i;
    p = init || _.modified(Forces, i) ? getForce(f[i])
      : pulse && modified(f[i], pulse) ? sim.force(name)
      : null;
    if (p) sim.force(name, p);
  }

  for (n=(sim.numForces || 0); i<n; ++i) {
    sim.force(Forces + i, null); // remove
  }

  sim.numForces = f.length;
  return sim;
}

function modified(f, pulse) {
  var k, v;
  for (k in f) {
    if (isFunction(v = f[k]) && pulse.modified(accessorFields(v)))
      return 1;
  }
  return 0;
}

function getForce(_) {
  var f, p;

  if (!hasOwnProperty(ForceMap, _.force)) {
    error('Unrecognized force: ' + _.force);
  }
  f = ForceMap[_.force]();

  for (p in _) {
    if (isFunction(f[p])) setForceParam(f[p], _[p], _);
  }

  return f;
}

function setForceParam(f, v, _) {
  f(isFunction(v) ? function(d) { return v(d, _); } : v);
}
