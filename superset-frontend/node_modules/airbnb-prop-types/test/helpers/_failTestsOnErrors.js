/* eslint no-console: 0 */

const consoleWarn = console.warn;
const consoleError = console.error;

const errorWhitelist = [
];

function throwError(msg) {
  if (errorWhitelist.every((regex) => !regex.test(msg))) throw new Error(msg);
}

console.warn = throwError;
console.error = throwError;

before(() => {
  console.error = throwError;
  console.warn = throwError;
});

beforeEach(() => {
  console.error = throwError;
  console.warn = throwError;
});

after(() => {
  console.warn = consoleWarn;
  console.error = consoleError;
});

afterEach(() => {
  console.warn = consoleWarn;
  console.error = consoleError;
});
