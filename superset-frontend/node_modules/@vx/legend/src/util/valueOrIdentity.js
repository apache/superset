export default function valueOrIdentity(x) {
  if (x && x.value) return x.value;
  return x;
}
