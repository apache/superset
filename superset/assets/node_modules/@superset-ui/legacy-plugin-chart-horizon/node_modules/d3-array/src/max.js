export default function max(values, valueof) {
  let max;
  if (valueof === undefined) {
    for (let value of values) {
      if (value != null
          && value >= value
          && (max === undefined || max < value)) {
        max = value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null
          && value >= value
          && (max === undefined || max < value)) {
        max = value;
      }
    }
  }
  return max;
}
