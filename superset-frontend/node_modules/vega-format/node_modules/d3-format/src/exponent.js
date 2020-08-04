import formatDecimal from "./formatDecimal.js";

export default function(x) {
  return x = formatDecimal(Math.abs(x)), x ? x[1] : NaN;
}
