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

import { RuleTester } from 'oxlint/plugins-dev';
import plugin from '.';

const ruleTester = new RuleTester();
const rule = plugin.rules['no-literal-colors'];

const errors: Array<{ message: string }> = [
  {
    message:
      'Theme color variables are preferred over rgb(a)/hex/literal colors',
  },
];

ruleTester.run('no-literal-colors', rule, {
  valid: [
    'const styles = { color: theme.colorText, background: theme.colorBg };',
    "const colors = { red: 'not a property value' };",
    "const color = 'red';",
    'styled.div`color: ${theme.colorText};`',
  ],
  invalid: [
    {
      code: "const styles = { color: 'red' };",
      errors,
    },
    {
      code: "const styles = { background: '#fff' };",
      errors,
    },
    {
      code: "const styles = { color: 'rgb(1, 2, 3)' };",
      errors,
    },
    {
      code: 'styled.div`color: red;`',
      errors,
    },
    {
      code: 'const styles = () => `background: #fff;`;',
      errors,
    },
  ],
});
