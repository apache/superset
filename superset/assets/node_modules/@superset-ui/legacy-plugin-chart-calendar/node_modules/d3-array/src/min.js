export default function min(values, valueof) {
  let min;
  if (valueof === undefined) {
    for (let value of values) {
      if (value != null
          && value >= value
          && (min === undefined || min > value)) {
        min = value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null
          && value >= value
          && (min === undefined || min > value)) {
        min = value;
      }
    }
  }
  return min;
}
