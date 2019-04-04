import variance from "./variance";

export default function(array, f) {
  var v = variance(array, f);
  return v ? Math.sqrt(v) : v;
}
