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
import isValidChild from 'src/dashboard/util/isValidChild';

import {
  CHART_TYPE as CHART,
  COLUMN_TYPE as COLUMN,
  DASHBOARD_GRID_TYPE as GRID,
  DASHBOARD_ROOT_TYPE as ROOT,
  DIVIDER_TYPE as DIVIDER,
  HEADER_TYPE as HEADER,
  MARKDOWN_TYPE as MARKDOWN,
  ROW_TYPE as ROW,
  TABS_TYPE as TABS,
  TAB_TYPE as TAB,
} from 'src/dashboard/util/componentTypes';

const getIndentation = depth =>
  Array(depth * 3)
    .fill('')
    .join('-');

describe('isValidChild', () => {
  describe('valid calls', () => {
    // these are representations of nested structures for easy testing
    //  [ROOT (depth 0) > GRID (depth 1) > HEADER (depth 2)]
    // every unique parent > child relationship is tested, but because this
    // test representation WILL result in duplicates, we hash each test
    // to keep track of which we've run
    const didTest = {};
    const validExamples = [
      [ROOT, GRID, CHART], // chart is valid because it is wrapped in a row
      [ROOT, GRID, MARKDOWN], // markdown is valid because it is wrapped in a row
      [ROOT, GRID, COLUMN], // column is valid because it is wrapped in a row
      [ROOT, GRID, HEADER],
      [ROOT, GRID, ROW, MARKDOWN],
      [ROOT, GRID, ROW, CHART],

      [ROOT, GRID, ROW, COLUMN, HEADER],
      [ROOT, GRID, ROW, COLUMN, DIVIDER],
      [ROOT, GRID, ROW, COLUMN, CHART],
      [ROOT, GRID, ROW, COLUMN, MARKDOWN],

      [ROOT, GRID, ROW, COLUMN, ROW, CHART],
      [ROOT, GRID, ROW, COLUMN, ROW, MARKDOWN],

      [ROOT, GRID, ROW, COLUMN, ROW, COLUMN, CHART],
      [ROOT, GRID, ROW, COLUMN, ROW, COLUMN, MARKDOWN],
      [ROOT, GRID, TABS, TAB, ROW, COLUMN, ROW, COLUMN, MARKDOWN],

      // tab equivalents
      [ROOT, TABS, TAB, CHART],
      [ROOT, TABS, TAB, MARKDOWN],
      [ROOT, TABS, TAB, COLUMN],
      [ROOT, TABS, TAB, HEADER],
      [ROOT, TABS, TAB, ROW, MARKDOWN],
      [ROOT, TABS, TAB, ROW, CHART],

      [ROOT, TABS, TAB, ROW, COLUMN, HEADER],
      [ROOT, TABS, TAB, ROW, COLUMN, DIVIDER],
      [ROOT, TABS, TAB, ROW, COLUMN, CHART],
      [ROOT, TABS, TAB, ROW, COLUMN, MARKDOWN],

      [ROOT, TABS, TAB, ROW, COLUMN, ROW, CHART],
      [ROOT, TABS, TAB, ROW, COLUMN, ROW, MARKDOWN],

      [ROOT, TABS, TAB, ROW, COLUMN, ROW, COLUMN, CHART],
      [ROOT, TABS, TAB, ROW, COLUMN, ROW, COLUMN, MARKDOWN],
      [ROOT, TABS, TAB, TABS, TAB, ROW, COLUMN, ROW, COLUMN, MARKDOWN],
    ];

    validExamples.forEach((example, exampleIdx) => {
      let childDepth = 0;
      example.forEach((childType, i) => {
        const parentDepth = childDepth - 1;
        const parentType = example[i - 1];
        const testKey = `${parentType}-${childType}-${parentDepth}`;

        if (i > 0 && !didTest[testKey]) {
          didTest[testKey] = true;

          it(`(${exampleIdx})${getIndentation(
            childDepth,
          )}${parentType} (depth ${parentDepth}) > ${childType} ✅`, () => {
            expect(
              isValidChild({
                parentDepth,
                parentType,
                childType,
              }),
            ).toBe(true);
          });
        }
        // see isValidChild.js for why tabs do not increment the depth of their children
        childDepth += childType !== TABS && childType !== TAB ? 1 : 0;
      });
    });
  });

  describe('invalid calls', () => {
    // In order to assert that a parent > child hierarchy at a given depth is invalid
    // we also define some valid hierarchies in doing so. we indicate which
    // parent > [child] relationships should be asserted as invalid using a nested array
    const invalidExamples = [
      [ROOT, [DIVIDER]],
      [ROOT, [CHART]],
      [ROOT, [MARKDOWN]],
      [ROOT, GRID, [TAB]],
      [ROOT, GRID, TABS, [ROW]],
      // [ROOT, GRID, TABS, TAB, [TABS]], // @TODO this needs to be fixed
      [ROOT, GRID, ROW, [TABS]],
      [ROOT, GRID, ROW, [TAB]],
      [ROOT, GRID, ROW, [DIVIDER]],
      [ROOT, GRID, ROW, COLUMN, [TABS]],
      [ROOT, GRID, ROW, COLUMN, [TAB]],
      [ROOT, GRID, ROW, COLUMN, ROW, [DIVIDER]],
      [ROOT, GRID, ROW, COLUMN, ROW, COLUMN, [ROW]], // too nested
    ];

    invalidExamples.forEach((example, exampleIdx) => {
      let childDepth = 0;
      example.forEach((childType, i) => {
        const shouldTestChild = Array.isArray(childType);

        if (i > 0 && shouldTestChild) {
          const parentDepth = childDepth - 1;
          const parentType = example[i - 1];

          it(`(${exampleIdx})${getIndentation(
            childDepth,
          )}${parentType} (depth ${parentDepth}) > ${childType} ❌`, () => {
            expect(
              isValidChild({
                parentDepth,
                parentType,
                childType,
              }),
            ).toBe(false);
          });
        }
        // see isValidChild.js for why tabs do not increment the depth of their children
        childDepth += childType !== TABS && childType !== TAB ? 1 : 0;
      });
    });
  });
});
