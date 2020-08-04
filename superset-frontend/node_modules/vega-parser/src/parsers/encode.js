import applyDefaults from './encode/defaults';
import entry from './encode/entry';
import rule from './encode/rule';

import {parseExpression} from 'vega-functions';
import {extend, isArray} from 'vega-util';

export default function(encode, type, role, style, scope, params) {
  const enc = {};
  params = params || {};
  params.encoders = {$encode: enc};

  encode = applyDefaults(encode, type, role, style, scope.config);
  for (const key in encode) {
    enc[key] = parseBlock(encode[key], type, params, scope);
  }

  return params;
}

function parseBlock(block, marktype, params, scope) {
  const channels = {},
        fields = {};

  for (const name in block) {
    if (block[name] != null) { // skip any null entries
      channels[name] = parse(expr(block[name]), scope, params, fields);
    }
  }

  return {
    $expr:   {marktype, channels},
    $fields: Object.keys(fields),
    $output: Object.keys(block)
  };
}

function expr(enc) {
  return isArray(enc) ? rule(enc) : entry(enc);
}

function parse(code, scope, params, fields) {
  const expr = parseExpression(code, scope);
  expr.$fields.forEach(name => fields[name] = 1);
  extend(params, expr.$params);
  return expr.$expr;
}
