// A safe alternative to JS's eval
import vm from 'vm';
import _ from 'underscore';
import * as d3array from 'd3-array';
import * as colors from './colors';

// Objects exposed here should be treated like a public API
// if `underscore` had backwards incompatible changes in a future release, we'd
// have to be careful about bumping the library as those changes could break user charts
const GLOBAL_CONTEXT = {
  console,
  _,
  colors,
  d3array,
};

// Copied/modified from https://github.com/hacksparrow/safe-eval/blob/master/index.js
export default function sandboxedEval(code, context, opts) {
  const sandbox = {};
  const resultKey = 'SAFE_EVAL_' + Math.floor(Math.random() * 1000000);
  sandbox[resultKey] = {};
  const codeToEval = resultKey + '=' + code;
  const sandboxContext = { ...GLOBAL_CONTEXT, ...context };
  Object.keys(sandboxContext).forEach(function (key) {
    sandbox[key] = sandboxContext[key];
  });
  try {
    vm.runInNewContext(codeToEval, sandbox, opts);
    return sandbox[resultKey];
  } catch (error) {
    return () => error;
  }
}
