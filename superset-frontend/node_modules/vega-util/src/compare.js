import {default as accessor, accessorFields} from './accessor';
import array from './array';
import field from './field';
import isFunction from './isFunction';

const DESCENDING = 'descending';

export default function(fields, orders, opt) {
  opt = opt || {};
  orders = array(orders) || [];

  const ord = [], get = [], fmap = {},
        gen = opt.comparator || comparator;

  array(fields).forEach((f, i) => {
    if (f == null) return;
    ord.push(orders[i] === DESCENDING ? -1 : 1);
    get.push(f = isFunction(f) ? f : field(f, null, opt));
    (accessorFields(f) || []).forEach(_ => fmap[_] = 1);
  });

  return get.length === 0
    ? null
    : accessor(gen(get, ord), Object.keys(fmap));
}

const compare = (u, v) => (u < v || u == null) && v != null ? -1
  : (u > v || v == null) && u != null ? 1
  : ((v = v instanceof Date ? +v : v), (u = u instanceof Date ? +u : u)) !== u && v === v ? -1
  : v !== v && u === u ? 1
  : 0;

const comparator = (fields, orders) => fields.length === 1
  ? compare1(fields[0], orders[0])
  : compareN(fields, orders, fields.length);

const compare1 = (field, order) => function(a, b) {
  return compare(field(a), field(b)) * order;
};

const compareN = (fields, orders, n) => {
  orders.push(0); // pad zero for convenient lookup
  return function(a, b) {
    let f, c = 0, i = -1;
    while (c === 0 && ++i < n) {
      f = fields[i];
      c = compare(f(a), f(b));
    }
    return c * orders[i];
  };
};
