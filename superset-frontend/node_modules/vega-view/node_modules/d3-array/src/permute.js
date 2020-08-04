export default function(source, keys) {
  return Array.from(keys, key => source[key]);
}
