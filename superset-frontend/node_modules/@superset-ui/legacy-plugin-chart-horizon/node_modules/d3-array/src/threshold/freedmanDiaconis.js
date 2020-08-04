import count from "../count.js";
import quantile from "../quantile.js";

export default function(values, min, max) {
  return Math.ceil((max - min) / (2 * (quantile(values, 0.75) - quantile(values, 0.25)) * Math.pow(count(values), -1 / 3)));
}
