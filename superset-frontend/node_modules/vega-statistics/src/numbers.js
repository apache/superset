export default function*(values, valueof) {
  if (valueof == null) {
    for (let value of values) {
      if (value != null && value !== '' && (value = +value) >= value) {
        yield value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      value = valueof(value, ++index, values);
      if (value != null && value !== '' && (value = +value) >= value) {
        yield value;
      }
    }
  }
}
