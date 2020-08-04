module.exports = function() {
  var head = null,
      tail = null;
  return {
    empty: function() {
      return !tail;
    },
    push: function(value) {
      var node = {value: value, next: null};
      if (tail) tail = tail.next = node;
      else head = tail = node;
      return value;
    },
    pop: function() {
      if (!head) return null;
      var value = head.value;
      if (head === tail) head = tail = null;
      else head = head.next;
      return value;
    }
  };
};
