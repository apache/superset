export default function(array, filter, visitor) {
  if (array) {
    if (filter) {
      var i = 0, n = array.length, t;
      for (; i<n; ++i) {
        if (t = filter(array[i])) visitor(t, i, array);
      }
    } else {
      array.forEach(visitor);
    }
  }
}
