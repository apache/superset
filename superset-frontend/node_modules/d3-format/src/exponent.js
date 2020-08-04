import formatDecimal from "./formatDecimal";

export default function(x) {
  return x = formatDecimal(Math.abs(x)), x ? x[1] : NaN;
}
