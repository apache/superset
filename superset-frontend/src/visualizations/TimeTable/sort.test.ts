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

import sortFn from './SortNumberWithMixedTypes';

describe('sort Number and mixed types', () => {
  const columnId = 'mLnVxkc1g';
  const rowA = {
    values: {
      metric: 'Albania',
      mLnVxkc1g: {
        props: {
          'data-value': null,
        },
      },
    },
  };
  const rowB = {
    values: {
      metric: 'Afghanistan',
      mLnVxkc1g: {
        props: {
          'data-value': -0.6749999999999972,
        },
      },
    },
  };
  const rowC = {
    values: {
      metric: 'Malawi',
      mLnVxkc1g: {
        props: {
          'data-value': 4.852999999999994,
        },
      },
    },
  };

  it('should treat null values as smallest', () => {
    // @ts-ignore
    expect(sortFn(rowA, rowB, columnId)).toBe(-1);
    // @ts-ignore
    expect(sortFn(rowA, rowC, columnId)).toBe(-1);
    // @ts-ignore
    expect(sortFn(rowB, rowC, columnId)).toBe(
      rowB.values[columnId].props['data-value'] -
        rowC.values[columnId].props['data-value'],
    );
  });
});
