import {adjustSpatial} from './util';
import {stringValue} from 'vega-util';

function expression(ctx, args, code) {
  // wrap code in return statement if expression does not terminate
  if (code[code.length-1] !== ';') {
    code = 'return(' + code + ');';
  }
  var fn = Function.apply(null, args.concat(code));
  return ctx && ctx.functions ? fn.bind(ctx.functions) : fn;
}

// generate code for comparing a single field
function _compare(u, v, lt, gt) {
  return `((u = ${u}) < (v = ${v}) || u == null) && v != null ? ${lt}
  : (u > v || v == null) && u != null ? ${gt}
  : ((v = v instanceof Date ? +v : v), (u = u instanceof Date ? +u : u)) !== u && v === v ? ${lt}
  : v !== v && u === u ? ${gt} : `;
}

export default {
  /**
   * Parse an expression used to update an operator value.
   */
  operator: (ctx, expr) => expression(ctx, ['_'], expr.code),

  /**
   * Parse an expression provided as an operator parameter value.
   */
  parameter: (ctx, expr) => expression(ctx, ['datum', '_'], expr.code),

  /**
   * Parse an expression applied to an event stream.
   */
  event: (ctx, expr) => expression(ctx, ['event'], expr.code),

  /**
   * Parse an expression used to handle an event-driven operator update.
   */
  handler: (ctx, expr) => {
    const code = `var datum=event.item&&event.item.datum;return ${expr.code};`;
    return expression(ctx, ['_', 'event'], code);
  },

  /**
   * Parse an expression that performs visual encoding.
   */
  encode: (ctx, encode) => {
    const {marktype, channels} = encode;

    let code = 'var o=item,datum=o.datum,m=0,$;';
    for (const name in channels) {
      const o ='o[' + stringValue(name) + ']';
      code += `$=${channels[name].code};if(${o}!==$)${o}=$,m=1;`;
    }
    code += adjustSpatial(channels, marktype);
    code += 'return m;';

    return expression(ctx, ['item', '_'], code);
  },

  /**
   * Optimized code generators for access and comparison.
   */
  codegen: {
    get(path) {
      const ref = `[${path.map(stringValue).join('][')}]`;
      const get = Function('_', `return _${ref};`);
      get.path = ref;
      return get;
    },
    comparator(fields, orders) {
      let t;
      const map = (f, i) => {
        const o = orders[i];
        let u, v;
        if (f.path) {
          u = `a${f.path}`;
          v = `b${f.path}`;
        } else {
          (t = t || {})['f'+i] = f;
          u = `this.f${i}(a)`;
          v = `this.f${i}(b)`;
        }
        return _compare(u, v, -o, o);
      };

      const fn = Function('a', 'b', 'var u, v; return '
        + fields.map(map).join('') + '0;');
      return t ? fn.bind(t) : fn;
    }
  }
};
