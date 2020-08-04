import identity from "./identity.js";

export default function group(values, ...keys) {
  return nest(values, identity, identity, keys);
}

export function groups(values, ...keys) {
  return nest(values, Array.from, identity, keys);
}

export function rollup(values, reduce, ...keys) {
  return nest(values, identity, reduce, keys);
}

export function rollups(values, reduce, ...keys) {
  return nest(values, Array.from, reduce, keys);
}

function nest(values, map, reduce, keys) {
  return (function regroup(values, i) {
    if (i >= keys.length) return reduce(values);
    const groups = new Map();
    const keyof = keys[i++];
    let index = -1;
    for (const value of values) {
      const key = keyof(value, ++index, values);
      const group = groups.get(key);
      if (group) group.push(value);
      else groups.set(key, [value]);
    }
    for (const [key, values] of groups) {
      groups.set(key, regroup(values, i));
    }
    return map(groups);
  })(values, 0);
}
