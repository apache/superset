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
 * @fileoverview Test file for the no-fa-icons-usage rule
 * @author Apache
 */

const { RuleTester } = require('eslint');
const plugin = require('.');

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------
const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 6 } });
const rule = plugin.rules['no-fa-icons-usage'];

const errors = [
  {
    message:
      'FontAwesome icons should not be used. Use the src/components/Icons component instead.',
  },
];

ruleTester.run('no-fa-icons-usage', rule, {
  valid: ['<Icons.Database />', '<Icons.Search />'],
  invalid: [
    {
      code: '<i className="fa fa-database"></i>',
      errors,
    },
    {
      code: '<i className="fa fa-search"></i>',
      errors,
    },
    {
      code: '<i className="fa fa-home"></i>',
      errors,
    },
    {
      code: '<i className="fa fa-arrow-right"></i>',
      errors,
    },
  ],
});
