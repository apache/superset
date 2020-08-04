import {tupleid} from 'vega-dataflow';
import {bootstrapCI, quartiles} from 'vega-statistics';
import {extentIndex, field, hasOwnProperty} from 'vega-util';

export default function TupleStore(key) {
  this._key = key ? field(key) : tupleid;
  this.reset();
}

var prototype = TupleStore.prototype;

prototype.reset = function() {
  this._add = [];
  this._rem = [];
  this._ext = null;
  this._get = null;
  this._q = null;
};

prototype.add = function(v) {
  this._add.push(v);
};

prototype.rem = function(v) {
  this._rem.push(v);
};

prototype.values = function() {
  this._get = null;
  if (this._rem.length === 0) return this._add;

  var a = this._add,
      r = this._rem,
      k = this._key,
      n = a.length,
      m = r.length,
      x = Array(n - m),
      map = {}, i, j, v;

  // use unique key field to clear removed values
  for (i=0; i<m; ++i) {
    map[k(r[i])] = 1;
  }
  for (i=0, j=0; i<n; ++i) {
    if (map[k(v = a[i])]) {
      map[k(v)] = 0;
    } else {
      x[j++] = v;
    }
  }

  this._rem = [];
  return (this._add = x);
};

// memoizing statistics methods

prototype.distinct = function(get) {
  var v = this.values(),
      n = v.length,
      map = {},
      count = 0, s;

  while (--n >= 0) {
    s = get(v[n]) + '';
    if (!hasOwnProperty(map, s)) {
      map[s] = 1;
      ++count;
    }
  }

  return count;
};

prototype.extent = function(get) {
  if (this._get !== get || !this._ext) {
    var v = this.values(),
        i = extentIndex(v, get);
    this._ext = [v[i[0]], v[i[1]]];
    this._get = get;
  }
  return this._ext;
};

prototype.argmin = function(get) {
  return this.extent(get)[0] || {};
};

prototype.argmax = function(get) {
  return this.extent(get)[1] || {};
};

prototype.min = function(get) {
  var m = this.extent(get)[0];
  return m != null ? get(m) : undefined;
};

prototype.max = function(get) {
  var m = this.extent(get)[1];
  return m != null ? get(m) : undefined;
};

prototype.quartile = function(get) {
  if (this._get !== get || !this._q) {
    this._q = quartiles(this.values(), get);
    this._get = get;
  }
  return this._q;
};

prototype.q1 = function(get) {
  return this.quartile(get)[0];
};

prototype.q2 = function(get) {
  return this.quartile(get)[1];
};

prototype.q3 = function(get) {
  return this.quartile(get)[2];
};

prototype.ci = function(get) {
  if (this._get !== get || !this._ci) {
    this._ci = bootstrapCI(this.values(), 1000, 0.05, get);
    this._get = get;
  }
  return this._ci;
};

prototype.ci0 = function(get) {
  return this.ci(get)[0];
};

prototype.ci1 = function(get) {
  return this.ci(get)[1];
};
