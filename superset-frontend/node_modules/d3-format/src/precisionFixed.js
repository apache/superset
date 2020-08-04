import exponent from "./exponent";

export default function(step) {
  return Math.max(0, -exponent(Math.abs(step)));
}
