/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
// A safe alternative to JS's eval
import vm, { Context, RunningScriptOptions } from 'vm';
import _ from 'underscore';
/* eslint-disable-next-line no-restricted-syntax */
import * as d3array from 'd3-array';
/* eslint-disable-next-line no-restricted-syntax */
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

type GlobalContext = {
  console: Console;
  _: _.UnderscoreStatic;
  colors: typeof colors;
  d3array: typeof d3array;
};

// Copied/modified from https://github.com/hacksparrow/safe-eval/blob/master/index.js
export default function sandboxedEval(
  code: string,
  context?: Context,
  opts?: RunningScriptOptions | string,
) {
  const sandbox: Context = {};
  const resultKey = `SAFE_EVAL_${Math.floor(Math.random() * 1000000)}`;
  sandbox[resultKey] = {};
  const codeToEval = `${resultKey}=${code}`;
  const sandboxContext: GlobalContext = { ...GLOBAL_CONTEXT, ...context };
  Object.keys(sandboxContext).forEach(key => {
    sandbox[key] = sandboxContext[key as keyof GlobalContext];
  });
  try {
    vm.runInNewContext(codeToEval, sandbox, opts);

    return sandbox[resultKey];
  } catch (error) {
    return () => error;
  }
}
