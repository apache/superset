function addIfNew(list, value) {
  if (list.indexOf(value) === -1) {
    list.push(value);
  }
}

export default function addNewValuesOnly(list, values) {
  if (Array.isArray(values)) {
    for (var i = 0, len = values.length; i < len; ++i) {
      addIfNew(list, values[i]);
    }
  } else {
    addIfNew(list, values);
  }
}