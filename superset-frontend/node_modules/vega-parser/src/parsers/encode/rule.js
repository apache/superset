import entry from './entry';
import {peek} from 'vega-util';

export default function(enc) {
  let code = '';

  enc.forEach(rule => {
    const value = entry(rule);
    code += rule.test ? `(${rule.test})?${value}:` : value;
  });

  // if no else clause, terminate with null (#1366)
  if (peek(code) === ':') {
    code += 'null';
  }

  return code;
}
