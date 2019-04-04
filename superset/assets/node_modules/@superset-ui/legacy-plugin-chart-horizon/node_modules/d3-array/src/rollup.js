function dogroup(values, keyof) {
  const map = new Map();
  let index = -1;
  for (const value of values) {
    const key = keyof(value, ++index, values);
    const group = map.get(key);
    if (group) group.push(value);
    else map.set(key, [value]);
  }
  return map;
}

export default function rollup(values, reduce, ...keys) {
  return (function regroup(values, i) {
    if (i >= keys.length) return reduce(values);
    const map = dogroup(values, keys[i]);
    return new Map(Array.from(map, ([k, v]) => [k, regroup(v, i + 1)]));
  })(values, 0);
}
