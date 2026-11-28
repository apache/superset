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
import Chord from '../src/Chord';

test('renders SQL NULL distinctly in chord labels and tooltips', () => {
  // JSDOM does not measure SVG paths or text. Allow every label to fit.
  Object.defineProperties(SVGElement.prototype, {
    getTotalLength: { configurable: true, value: () => 500 },
    getComputedTextLength: { configurable: true, value: () => 10 },
  });

  const element = document.createElement('div');
  const quotedNull = '"<NULL>"';
  const nestedQuotedNull = JSON.stringify(quotedNull);
  const escapedNestedNull = JSON.stringify(nestedQuotedNull);
  const data = {
    nodes: [null, 'North', '<NULL>', quotedNull, nestedQuotedNull, 0],
    matrix: [
      [0, 4, 0, 0, 0, 0],
      [3, 0, 2, 1, 1, 0],
      [0, 1, 0, 0, 0, 1],
      [0, 1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
    ],
  };

  try {
    Chord(element, {
      data,
      width: 800,
      height: 600,
      colorScheme: 'd3Category10',
      numberFormat: '.0f',
      sliceId: 0,
    });
  } finally {
    Reflect.deleteProperty(SVGElement.prototype, 'getTotalLength');
    Reflect.deleteProperty(SVGElement.prototype, 'getComputedTextLength');
  }

  const text = (selector: string) =>
    Array.from(element.querySelectorAll(selector), node => node.textContent);

  expect(text('.group textPath')).toEqual([
    '<NULL>',
    'North',
    quotedNull,
    nestedQuotedNull,
    escapedNestedNull,
    '0',
  ]);
  expect(text('.group title')).toEqual([
    '<NULL>: 4',
    'North: 7',
    `${quotedNull}: 2`,
    `${nestedQuotedNull}: 1`,
    `${escapedNestedNull}: 1`,
    '0: 1',
  ]);
  const connectionTitles = text('.chord title');
  expect(connectionTitles).toContain('<NULL> → North: 3\nNorth → <NULL>: 4');
  expect(connectionTitles).toContain(
    `North → ${nestedQuotedNull}: 1\n${nestedQuotedNull} → North: 1`,
  );
  expect(data.nodes).toEqual([
    null,
    'North',
    '<NULL>',
    quotedNull,
    nestedQuotedNull,
    0,
  ]);
});
