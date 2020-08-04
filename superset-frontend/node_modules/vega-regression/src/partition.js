export default function(data, groupby) {
  var groups = [],
      get = function(f) { return f(t); },
      map, i, n, t, k, g;

  // partition data points into stack groups
  if (groupby == null) {
    groups.push(data);
  } else {
    for (map={}, i=0, n=data.length; i<n; ++i) {
      t = data[i];
      k = groupby.map(get);
      g = map[k];
      if (!g) {
        map[k] = (g = []);
        g.dims = k;
        groups.push(g);
      }
      g.push(t);
    }
  }

  return groups;
}
