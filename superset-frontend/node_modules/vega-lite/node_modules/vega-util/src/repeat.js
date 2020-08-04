export default function(str, reps) {
  var s = '';
  while (--reps >= 0) s += str;
  return s;
}
