export default function(_) {
  for (var s={}, i=0, n=_.length; i<n; ++i) s[_[i]] = true;
  return s;
}
