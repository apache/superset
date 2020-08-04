import count from "../count.js";

export default function(values) {
  return Math.ceil(Math.log(count(values)) / Math.LN2) + 1;
}
