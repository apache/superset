var map = Array.prototype.map;

export function numbers(_) {
  return map.call(_, function(x) { return +x; });
}
