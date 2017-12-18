// A safe alternative to JS's eval
import vm from 'vm';
import moment from 'moment';
import d3 from 'd3';
import _ from 'underscore';

const GLOBAL_CONTEXT = {
  moment,
  d3,
  console,
  _,
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
  vm.runInNewContext(codeToEval, sandbox, opts);
  return sandbox[resultKey];
}
