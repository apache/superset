export default function(method) {
  const cache = {};
  return spec => cache[spec] || (cache[spec] = method(spec));
}
