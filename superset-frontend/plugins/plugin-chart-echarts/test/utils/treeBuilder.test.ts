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

import { treeBuilder } from '../../src/utils/treeBuilder';

describe('test treeBuilder', () => {
  const data = [
    {
      foo: 'a-1',
      bar: 'a',
      count: 2,
      count2: 3,
    },
    {
      foo: 'a-2',
      bar: 'a',
      count: 2,
      count2: 3,
    },
    {
      foo: 'b-1',
      bar: 'b',
      count: 2,
      count2: 3,
    },
    {
      foo: 'b-2',
      bar: 'b',
      count: 2,
      count2: 3,
    },
    {
      foo: 'c-1',
      bar: 'c',
      count: 2,
      count2: 3,
    },
    {
      foo: 'c-2',
      bar: 'c',
      count: 2,
      count2: 3,
    },
    {
      foo: 'd-1',
      bar: 'd',
      count: 2,
      count2: 3,
    },
  ];
  test('should build tree as expected', () => {
    const tree = treeBuilder(data, ['foo', 'bar'], 'count');
    expect(tree).toEqual([
      {
        children: [
          {
            groupBy: 'bar',
            name: 'a',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'a-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'a',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'a-2',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'b',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'b-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'b',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'b-2',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'c',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'c-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'c',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'c-2',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'd',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'd-1',
        secondaryValue: 2,
        value: 2,
      },
    ]);
  });

  test('should build tree with secondaryValue as expected', () => {
    const tree = treeBuilder(data, ['foo', 'bar'], 'count', 'count2');
    expect(tree).toEqual([
      {
        children: [
          {
            groupBy: 'bar',
            name: 'a',
            secondaryValue: 3,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'a-1',
        secondaryValue: 3,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'a',
            secondaryValue: 3,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'a-2',
        secondaryValue: 3,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'b',
            secondaryValue: 3,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'b-1',
        secondaryValue: 3,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'b',
            secondaryValue: 3,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'b-2',
        secondaryValue: 3,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'c',
            secondaryValue: 3,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'c-1',
        secondaryValue: 3,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'c',
            secondaryValue: 3,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'c-2',
        secondaryValue: 3,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'd',
            secondaryValue: 3,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'd-1',
        secondaryValue: 3,
        value: 2,
      },
    ]);
  });

  test('include null values', () => {
    const tree = treeBuilder(
      [
        ...data,
        {
          foo: 'a-2',
          bar: null,
          count: 2,
          count2: 3,
        },
      ],
      ['foo', 'bar'],
      'count',
    );
    expect(tree).toEqual([
      {
        children: [
          {
            groupBy: 'bar',
            name: 'a',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'a-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'a',
            secondaryValue: 2,
            value: 2,
          },
          {
            groupBy: 'bar',
            name: null,
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'a-2',
        secondaryValue: 4,
        value: 4,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'b',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'b-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'b',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'b-2',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'c',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'c-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'c',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'c-2',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'd',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'd-1',
        secondaryValue: 2,
        value: 2,
      },
    ]);
  });

  test('filter null values in a nested layer (parent total excludes hidden nulls)', () => {
    const tree = treeBuilder(
      [
        ...data,
        {
          foo: 'a-2',
          bar: null,
          count: 2,
          count2: 3,
        },
      ],
      ['foo', 'bar'],
      'count',
      undefined,
      true,
    );
    expect(tree).toEqual([
      {
        children: [
          {
            groupBy: 'bar',
            name: 'a',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'a-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        // The null `bar` child is removed AND its value is excluded from the
        // parent total, so the arc stays sized to its visible children (no gap).
        children: [
          {
            groupBy: 'bar',
            name: 'a',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'a-2',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'b',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'b-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'b',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'b-2',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'c',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'c-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'c',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'c-2',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [
          {
            groupBy: 'bar',
            name: 'd',
            secondaryValue: 2,
            value: 2,
          },
        ],
        groupBy: 'foo',
        name: 'd-1',
        secondaryValue: 2,
        value: 2,
      },
    ]);
  });

  // Regression: a single-level (single column) sunburst previously never
  // filtered, because filtering only happened in the multi-level branch.
  test('single-level: shows null nodes when filtering is off', () => {
    const tree = treeBuilder(
      [
        { foo: 'a', count: 2, count2: 3 },
        { foo: null, count: 5, count2: 7 },
      ],
      ['foo'],
      'count',
    );
    expect(tree).toEqual([
      { groupBy: 'foo', name: 'a', secondaryValue: 2, value: 2 },
      { groupBy: 'foo', name: null, secondaryValue: 5, value: 5 },
    ]);
  });

  test('single-level: removes null nodes when filtering is on', () => {
    const tree = treeBuilder(
      [
        { foo: 'a', count: 2, count2: 3 },
        { foo: null, count: 5, count2: 7 },
      ],
      ['foo'],
      'count',
      undefined,
      true,
    );
    expect(tree).toEqual([
      { groupBy: 'foo', name: 'a', secondaryValue: 2, value: 2 },
    ]);
  });

  // Regression: a null in the *root* (first) column previously slipped through
  // because the top-level result array was never filtered.
  test('multi-level: shows null root node when filtering is off', () => {
    const tree = treeBuilder(
      [
        { foo: 'a-1', bar: 'a', count: 2, count2: 3 },
        { foo: null, bar: 'x', count: 5, count2: 7 },
      ],
      ['foo', 'bar'],
      'count',
    );
    expect(tree).toEqual([
      {
        children: [{ groupBy: 'bar', name: 'a', secondaryValue: 2, value: 2 }],
        groupBy: 'foo',
        name: 'a-1',
        secondaryValue: 2,
        value: 2,
      },
      {
        children: [{ groupBy: 'bar', name: 'x', secondaryValue: 5, value: 5 }],
        groupBy: 'foo',
        name: null,
        secondaryValue: 5,
        value: 5,
      },
    ]);
  });

  test('multi-level: removes null root node (and its subtree) when filtering is on', () => {
    const tree = treeBuilder(
      [
        { foo: 'a-1', bar: 'a', count: 2, count2: 3 },
        { foo: null, bar: 'x', count: 5, count2: 7 },
      ],
      ['foo', 'bar'],
      'count',
      undefined,
      true,
    );
    expect(tree).toEqual([
      {
        children: [{ groupBy: 'bar', name: 'a', secondaryValue: 2, value: 2 }],
        groupBy: 'foo',
        name: 'a-1',
        secondaryValue: 2,
        value: 2,
      },
    ]);
  });

  // With a secondary metric, the parent's secondaryValue must also exclude the
  // hidden null child rather than leaving a stale (inflated) total.
  test('filtering excludes hidden nulls from secondary-metric totals', () => {
    const tree = treeBuilder(
      [
        { foo: 'p', bar: 'a', count: 2, count2: 3 },
        { foo: 'p', bar: null, count: 2, count2: 7 },
      ],
      ['foo', 'bar'],
      'count',
      'count2',
      true,
    );
    expect(tree).toEqual([
      {
        children: [{ groupBy: 'bar', name: 'a', secondaryValue: 3, value: 2 }],
        groupBy: 'foo',
        name: 'p',
        secondaryValue: 3,
        value: 2,
      },
    ]);
  });

  // A parent whose children are all null must be dropped, not kept as a
  // zero-value arc: a retained `value: 0` node yields NaN for the
  // secondaryValue/value ratio used in linear coloring and tooltips.
  test('filtering drops parents left with no children', () => {
    const tree = treeBuilder(
      [
        { foo: 'keep', bar: 'a', count: 2, count2: 3 },
        { foo: 'drop', bar: null, count: 5, count2: 7 },
      ],
      ['foo', 'bar'],
      'count',
      'count2',
      true,
    );
    expect(tree).toEqual([
      {
        children: [{ groupBy: 'bar', name: 'a', secondaryValue: 3, value: 2 }],
        groupBy: 'foo',
        name: 'keep',
        secondaryValue: 3,
        value: 2,
      },
    ]);
  });
});
