function compose(a, b) {
  return function(arg) {
    return a(b(arg));
  };
}

module.exports = compose;