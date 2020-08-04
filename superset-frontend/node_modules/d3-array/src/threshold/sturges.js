export default function(values) {
  return Math.ceil(Math.log(values.length) / Math.LN2) + 1;
}
