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
 * @fileoverview Test file for the no-direct-ant-icons-import rule
 * @author Apache
 */

const { RuleTester } = require('eslint');
const plugin = require('.');

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 6 } });
const rule = plugin.rules['no-direct-ant-icons-import'];

const errors = [
  { message: "Avoid importing icons directly from '@ant-design/icons'." },
];

ruleTester.run('no-direct-ant-icons-import', rule, {
  valid: ["import { BarChartOutlined } from 'src/components/icons';"],
  invalid: [
    {
      code: "import { BarChartOutlined } from '@ant-design/icons';",
      errors,
    },
    {
      code: "import { LineChartOutlined, PieChartOutlined } from '@ant-design/icons';",
      errors,
    },
    {
      code: "import * as AntIcons from '@ant-design/icons';",
      errors,
    },
    {
      code: "import * as Icons from '@ant-design/icons/lib';",
      errors,
    },
  ],
});
