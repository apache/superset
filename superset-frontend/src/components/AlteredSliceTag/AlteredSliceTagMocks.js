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

export const defaultProps = {
  origFormData: {
    viz_type: 'altered_slice_tag_spec',
    adhoc_filters: [
      {
        clause: 'WHERE',
        comparator: 'hello',
        expressionType: 'SIMPLE',
        operator: '==',
        subject: 'a',
      },
    ],
    y_axis_bounds: [10, 20],
    column_collection: [{ 1: 'a', b: ['6', 'g'] }],
    bool: false,
    alpha: undefined,
    gucci: [1, 2, 3, 4],
    never: 5,
    ever: { a: 'b', c: 'd' },
  },
  currentFormData: {
    adhoc_filters: [
      {
        clause: 'WHERE',
        comparator: ['hello', 'my', 'name'],
        expressionType: 'SIMPLE',
        operator: 'IN',
        subject: 'b',
      },
    ],
    y_axis_bounds: [15, 16],
    column_collection: [{ 1: 'a', b: [9, '15'], t: 'gggg' }],
    bool: true,
    alpha: null,
    gucci: ['a', 'b', 'c', 'd'],
    never: 10,
    ever: { x: 'y', z: 'z' },
  },
};

export const expectedDiffs = {
  adhoc_filters: {
    before: [
      {
        clause: 'WHERE',
        comparator: 'hello',
        expressionType: 'SIMPLE',
        operator: '==',
        subject: 'a',
      },
    ],
    after: [
      {
        clause: 'WHERE',
        comparator: ['hello', 'my', 'name'],
        expressionType: 'SIMPLE',
        operator: 'IN',
        subject: 'b',
      },
    ],
  },
  y_axis_bounds: {
    before: [10, 20],
    after: [15, 16],
  },
  column_collection: {
    before: [{ 1: 'a', b: ['6', 'g'] }],
    after: [{ 1: 'a', b: [9, '15'], t: 'gggg' }],
  },
  bool: {
    before: false,
    after: true,
  },
  gucci: {
    before: [1, 2, 3, 4],
    after: ['a', 'b', 'c', 'd'],
  },
  never: {
    before: 5,
    after: 10,
  },
  ever: {
    before: { a: 'b', c: 'd' },
    after: { x: 'y', z: 'z' },
  },
};
export const expectedRows = [
  {
    control: 'Fake Filters',
    before: 'a == hello',
    after: 'b IN [hello, my, name]',
  },
  {
    control: 'Value bounds',
    before: 'Min: 10, Max: 20',
    after: 'Min: 15, Max: 16',
  },
  {
    control: 'Fake Collection Control',
    before: '{"1":"a","b":["6","g"]}',
    after: '{"1":"a","b":[9,"15"],"t":"gggg"}',
  },
  { control: 'bool', before: 'false', after: 'true' },
  { control: 'gucci', before: '1, 2, 3, 4', after: 'a, b, c, d' },
  { control: 'never', before: 5, after: 10 },
  {
    control: 'ever',
    before: '{"a":"b","c":"d"}',
    after: '{"x":"y","z":"z"}',
  },
];
export const fakePluginControls = {
  controlPanelSections: [
    {
      label: 'Fake Control Panel Sections',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: 'Value bounds',
              default: [null, null],
              description: 'Value bounds for the y axis',
            },
          },
          {
            name: 'column_collection',
            config: {
              type: 'CollectionControl',
              label: 'Fake Collection Control',
            },
          },
          {
            name: 'adhoc_filters',
            config: {
              type: 'AdhocFilterControl',
              label: 'Fake Filters',
              default: null,
            },
          },
          {
            name: 'metrics',
            config: {
              type: 'MetricsControl',
              label: 'Fake Metrics',
              default: null,
            },
          },
        ],
      ],
    },
  ],
};
