import {error, zero} from 'vega-util';

export function WindowOp(op, field, param, as) {
  let fn = WindowOps[op](field, param);
  return {
    init:   fn.init || zero,
    update: function(w, t) { t[as] = fn.next(w); }
  };
}

export const WindowOps = {
  row_number: function() {
    return {
      next: w => w.index + 1
    };
  },
  rank: function() {
    let rank;
    return {
      init: () => rank = 1,
      next: w => {
        let i = w.index,
            data = w.data;
        return (i && w.compare(data[i - 1], data[i])) ? (rank = i + 1) : rank;
      }
    };
  },
  dense_rank: function() {
    let drank;
    return {
      init: () => drank = 1,
      next: w => {
        let i = w.index,
            d = w.data;
        return (i && w.compare(d[i - 1], d[i])) ? ++drank : drank;
      }
    };
  },
  percent_rank: function() {
    let rank = WindowOps.rank(),
        next = rank.next;
    return {
      init: rank.init,
      next: w => (next(w) - 1) / (w.data.length - 1)
    };
  },
  cume_dist: function() {
    let cume;
    return {
      init: () => cume = 0,
      next: w => {
        let i = w.index,
            d = w.data,
            c = w.compare;
        if (cume < i) {
          while (i + 1 < d.length && !c(d[i], d[i + 1])) ++i;
          cume = i;
        }
        return (1 + cume) / d.length;
      }
    };
  },
  ntile: function(field, num) {
    num = +num;
    if (!(num > 0)) error('ntile num must be greater than zero.');
    let cume = WindowOps.cume_dist(),
        next = cume.next;
    return {
      init: cume.init,
      next: w => Math.ceil(num * next(w))
    };
  },

  lag: function(field, offset) {
    offset = +offset || 1;
    return {
      next: w => {
        let i = w.index - offset;
        return i >= 0 ? field(w.data[i]) : null;
      }
    };
  },
  lead: function(field, offset) {
    offset = +offset || 1;
    return {
      next: w => {
        let i = w.index + offset,
            d = w.data;
        return i < d.length ? field(d[i]) : null;
      }
    };
  },

  first_value: function(field) {
    return {
      next: w => field(w.data[w.i0])
    };
  },
  last_value: function(field) {
    return {
      next: w => field(w.data[w.i1 - 1])
    };
  },
  nth_value: function(field, nth) {
    nth = +nth;
    if (!(nth > 0)) error('nth_value nth must be greater than zero.');
    return {
      next: w => {
        let i = w.i0 + (nth - 1);
        return i < w.i1 ? field(w.data[i]) : null;
      }
    };
  },

  prev_value: function(field) {
    let prev;
    return {
      init: () => prev = null,
      next: w => {
        let v = field(w.data[w.index]);
        return v != null ? (prev = v) : prev;
      }
    };
  },
  next_value: function(field) {
    let v, i;
    return {
      init: () => (v = null, i = -1),
      next: w => {
        let d = w.data;
        return w.index <= i ? v
          : (i = find(field, d, w.index)) < 0
            ? (i = d.length, v = null)
            : (v = field(d[i]));
      }
    };
  }
};

function find(field, data, index) {
  for (let n = data.length; index < n; ++index) {
    let v = field(data[index]);
    if (v != null) return index;
  }
  return -1;
}

export var ValidWindowOps = Object.keys(WindowOps);
