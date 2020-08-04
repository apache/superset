function noop() {
  throw new Error("Macro has not been processed");
}

module.exports = {
  define: noop,

  assert: noop,
  assertRuntimeError: noop
};
