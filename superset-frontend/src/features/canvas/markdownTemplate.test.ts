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
import { renderTemplate } from './markdownTemplate';

const rows = [
  { country: 'USA', revenue: 3627982.83 },
  { country: 'Spain', revenue: 1215686.92 },
];

test('fills first-row placeholders, with optional number formats', () => {
  expect(renderTemplate('# {{country}}: {{revenue|$,.3s}}', rows)).toBe(
    '# USA: $3.63M',
  );
});

test('repeats a rows block once per row', () => {
  expect(
    renderTemplate('{{#rows}}- {{country}} {{revenue|,.0f}}\n{{/rows}}', rows),
  ).toBe('- USA 3,627,983\n- Spain 1,215,687\n');
});

test('shows a dash for missing values', () => {
  expect(renderTemplate('{{nope}}', rows)).toBe('–');
  expect(renderTemplate('{{country}}', [])).toBe('–');
});
