import parse from './dataflow';
import expressionCodegen from './expression';
import {
  parseOperator,
  parseOperatorParameters
} from './operator';
import parseParameters from './parameters';
import parseStream from './stream';
import parseUpdate from './update';

import {getState, setState} from './state';
import {canonicalType, isCollect} from './util';

/**
 * Context objects store the current parse state.
 * Enables lookup of parsed operators, event streams, accessors, etc.
 * Provides a 'fork' method for creating child contexts for subflows.
 */
export default function(df, transforms, functions, expr) {
  return new Context(df, transforms, functions, expr);
}

function Context(df, transforms, functions, expr) {
  this.dataflow = df;
  this.transforms = transforms;
  this.events = df.events.bind(df);
  this.expr = expr || expressionCodegen,
  this.signals = {};
  this.scales = {};
  this.nodes = {};
  this.data = {};
  this.fn = {};
  if (functions) {
    this.functions = Object.create(functions);
    this.functions.context = this;
  }
}

function Subcontext(ctx) {
  this.dataflow = ctx.dataflow;
  this.transforms = ctx.transforms;
  this.events = ctx.events;
  this.expr = ctx.expr;
  this.signals = Object.create(ctx.signals);
  this.scales = Object.create(ctx.scales);
  this.nodes = Object.create(ctx.nodes);
  this.data = Object.create(ctx.data);
  this.fn = Object.create(ctx.fn);
  if (ctx.functions) {
    this.functions = Object.create(ctx.functions);
    this.functions.context = this;
  }
}

Context.prototype = Subcontext.prototype = {
  fork() {
    const ctx = new Subcontext(this);
    (this.subcontext || (this.subcontext = [])).push(ctx);
    return ctx;
  },
  detach(ctx) {
    this.subcontext = this.subcontext.filter(c => c !== ctx);

    // disconnect all nodes in the subcontext
    // wipe out targets first for better efficiency
    const keys = Object.keys(ctx.nodes);
    for (const key of keys) ctx.nodes[key]._targets = null;
    for (const key of keys) ctx.nodes[key].detach();
    ctx.nodes = null;
  },
  get(id) {
    return this.nodes[id];
  },
  set(id, node) {
    return this.nodes[id] = node;
  },
  add(spec, op) {
    const ctx = this,
          df = ctx.dataflow,
          data = spec.value;

    ctx.set(spec.id, op);

    if (isCollect(spec.type) && data) {
      if (data.$ingest) {
        df.ingest(op, data.$ingest, data.$format);
      } else if (data.$request) {
        df.preload(op, data.$request, data.$format);
      } else {
        df.pulse(op, df.changeset().insert(data));
      }
    }

    if (spec.root) {
      ctx.root = op;
    }

    if (spec.parent) {
      var p = ctx.get(spec.parent.$ref);
      if (p) {
        df.connect(p, [op]);
        op.targets().add(p);
      } else {
        (ctx.unresolved = ctx.unresolved || []).push(() => {
          p = ctx.get(spec.parent.$ref);
          df.connect(p, [op]);
          op.targets().add(p);
        });
      }
    }

    if (spec.signal) {
      ctx.signals[spec.signal] = op;
    }

    if (spec.scale) {
      ctx.scales[spec.scale] = op;
    }

    if (spec.data) {
      for (const name in spec.data) {
        const data = ctx.data[name] || (ctx.data[name] = {});
        spec.data[name].forEach(role => data[role] = op);
      }
    }
  },
  resolve() {
    (this.unresolved || []).forEach(fn => fn());
    delete this.unresolved;
    return this;
  },
  operator(spec, update) {
    this.add(spec, this.dataflow.add(spec.value, update));
  },
  transform(spec, type) {
    this.add(spec, this.dataflow.add(this.transforms[canonicalType(type)]));
  },
  stream(spec, stream) {
    this.set(spec.id, stream);
  },
  update(spec, stream, target, update, params) {
    this.dataflow.on(stream, target, update, params, spec.options);
  },

  // expression parsing
  operatorExpression(expr) {
    return this.expr.operator(this, expr);
  },
  parameterExpression(expr) {
    return this.expr.parameter(this, expr);
  },
  eventExpression(expr) {
    return this.expr.event(this, expr);
  },
  handlerExpression(expr) {
    return this.expr.handler(this, expr);
  },
  encodeExpression(encode) {
    return this.expr.encode(this, encode);
  },

  // parse methods
  parse,
  parseOperator,
  parseOperatorParameters,
  parseParameters,
  parseStream,
  parseUpdate,

  // state methods
  getState,
  setState
};
