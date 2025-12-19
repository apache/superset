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

/**
 * @fileoverview Rule to warn about translation template variables
 * @author Apache
 */
/* eslint-disable no-template-curly-in-string */
const { RuleTester } = require('eslint');
const plugin = require('.');

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 6 } });
const rule = plugin.rules['no-template-vars'];

const errors = [
  {
    type: 'CallExpression',
  },
];

ruleTester.run('no-template-vars', rule, {
  valid: [
    't(`foo`)',
    'tn(`foo`)',
    't(`foo %s bar`)',
    'tn(`foo %s bar`)',
    't(`foo %s bar %s`)',
    'tn(`foo %s bar %s`)',
  ],
  invalid: [
    {
      code: 't(`foo${bar}`)',
      errors,
    },
    {
      code: 't(`foo${bar} ${baz}`)',
      errors,
    },
    {
      code: 'tn(`foo${bar}`)',
      errors,
    },
    {
      code: 'tn(`foo${bar} ${baz}`)',
      errors,
    },
  ],
});
