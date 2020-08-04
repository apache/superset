const errorWhitelist = [
];

function throwError(msg) {
  if (errorWhitelist.every(regex => !regex.test(msg))) throw new EvalError(msg);
}

console.warn = throwError;
console.error = throwError;
