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
import {
  formatBound,
  getBoundSeconds,
  getRefreshPolicyErrors,
  getStandardSeconds,
  RefreshBound,
  RefreshPolicyError,
  toBound,
} from '.';

type ParityCase = {
  name: string;
  metadata: Record<string, unknown>;
  readPolicy?: unknown;
  adminList?: unknown;
  expected: Record<string, RefreshPolicyError>;
};

// DASHBOARD_AUTO_REFRESH_INTERVALS as shipped in superset/config.py
const DEFAULT_LIST = [
  [0, "Don't refresh"],
  [10, '10 seconds'],
  [30, '30 seconds'],
  [60, '1 minute'],
  [300, '5 minutes'],
  [1800, '30 minutes'],
  [3600, '1 hour'],
  [21600, '6 hours'],
  [43200, '12 hours'],
  [86400, '24 hours'],
];

// Results of check_refresh_policy (superset/dashboards/refresh_policy.py)
// for the same inputs, recorded from the server.
const SERVER_CASES: ParityCase[] = [
  {
    name: 'no policy, custom 45',
    metadata: {
      refresh_frequency: 45,
    },
    expected: {},
  },
  {
    name: 'null policy',
    metadata: {
      refresh_frequency: 45,
      auto_refresh_policy: null,
    },
    expected: {},
  },
  {
    name: 'policy shape: not an object (string)',
    metadata: {
      refresh_frequency: 45,
      auto_refresh_policy: 'x',
    },
    expected: {
      auto_refresh_policy: {
        code: 'invalid_policy',
        message:
          'Auto-refresh policy must be an object with auto_refresh_allowed, minimum_refresh_interval and maximum_refresh_interval.',
      },
    },
  },
  {
    name: 'policy shape: not an object (array)',
    metadata: {
      refresh_frequency: 45,
      auto_refresh_policy: [],
    },
    expected: {
      auto_refresh_policy: {
        code: 'invalid_policy',
        message:
          'Auto-refresh policy must be an object with auto_refresh_allowed, minimum_refresh_interval and maximum_refresh_interval.',
      },
    },
  },
  {
    name: 'policy shape: not an object (number)',
    metadata: {
      refresh_frequency: 45,
      auto_refresh_policy: 5,
    },
    expected: {
      auto_refresh_policy: {
        code: 'invalid_policy',
        message:
          'Auto-refresh policy must be an object with auto_refresh_allowed, minimum_refresh_interval and maximum_refresh_interval.',
      },
    },
  },
  {
    name: 'policy shape: unknown key',
    metadata: {
      refresh_frequency: 300,
      auto_refresh_policy: {
        extra: 1,
      },
    },
    expected: {
      'auto_refresh_policy.extra': {
        code: 'invalid_policy',
        message: 'Unknown field.',
      },
    },
  },
  {
    name: "policy shape: 'true' switch, bad freq skipped",
    metadata: {
      refresh_frequency: 45,
      auto_refresh_policy: {
        auto_refresh_allowed: 'true',
      },
    },
    expected: {
      'auto_refresh_policy.auto_refresh_allowed': {
        code: 'invalid_policy',
        message: 'Must be true or false.',
      },
    },
  },
  {
    name: 'policy shape: 1 switch',
    metadata: {
      refresh_frequency: 0,
      auto_refresh_policy: {
        auto_refresh_allowed: 1,
      },
    },
    expected: {
      'auto_refresh_policy.auto_refresh_allowed': {
        code: 'invalid_policy',
        message: 'Must be true or false.',
      },
    },
  },
  {
    name: 'policy shape: unknown + invalid boundary bound',
    metadata: {
      refresh_frequency: 0,
      auto_refresh_policy: {
        extra: 1,
        minimum_refresh_interval: {
          value: 0,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.extra': {
        code: 'invalid_policy',
        message: 'Unknown field.',
      },
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'invalid boundary value 0',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 0,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'invalid boundary value -1',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: -1,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'invalid boundary value 1.5',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 1.5,
          unit: 'minutes',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: "invalid boundary value '30'",
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: '30',
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'invalid boundary value true',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: true,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'invalid boundary unit days',
    metadata: {
      auto_refresh_policy: {
        maximum_refresh_interval: {
          value: 1,
          unit: 'days',
        },
      },
    },
    expected: {
      'auto_refresh_policy.maximum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'invalid boundary unit second',
    metadata: {
      auto_refresh_policy: {
        maximum_refresh_interval: {
          value: 1,
          unit: 'second',
        },
      },
    },
    expected: {
      'auto_refresh_policy.maximum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'invalid boundary extra key',
    metadata: {
      auto_refresh_policy: {
        maximum_refresh_interval: {
          value: 1,
          unit: 'hours',
          x: 1,
        },
      },
    },
    expected: {
      'auto_refresh_policy.maximum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'invalid boundary bound is a string',
    metadata: {
      auto_refresh_policy: {
        maximum_refresh_interval: '1h',
      },
    },
    expected: {
      'auto_refresh_policy.maximum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
  },
  {
    name: 'null bound = no bound',
    metadata: {
      refresh_frequency: 45,
      auto_refresh_policy: {
        minimum_refresh_interval: null,
      },
    },
    expected: {
      refresh_frequency: {
        code: 'custom_not_allowed',
        message: 'Refresh frequency must be one of the standard intervals.',
      },
    },
  },
  {
    name: 'standard boundary 45 s changed',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 45,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message:
          "45 seconds isn't a standard interval. Select one from the list.",
      },
    },
    readPolicy: null,
  },
  {
    name: 'standard boundary 45 s unchanged',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 45,
          unit: 'seconds',
        },
      },
    },
    expected: {},
    readPolicy: {
      minimum_refresh_interval: {
        value: 45,
        unit: 'seconds',
      },
    },
  },
  {
    name: 'standard boundary 2 h changed',
    metadata: {
      auto_refresh_policy: {
        maximum_refresh_interval: {
          value: 2,
          unit: 'hours',
        },
      },
    },
    expected: {
      'auto_refresh_policy.maximum_refresh_interval': {
        code: 'invalid_boundary',
        message: "2 hours isn't a standard interval. Select one from the list.",
      },
    },
    readPolicy: null,
  },
  {
    name: 'standard boundary 2 h unchanged',
    metadata: {
      auto_refresh_policy: {
        maximum_refresh_interval: {
          value: 2,
          unit: 'hours',
        },
      },
    },
    expected: {},
    readPolicy: {
      maximum_refresh_interval: {
        value: 2,
        unit: 'hours',
      },
    },
  },
  {
    name: 'standard boundary 45 s while prohibited',
    metadata: {
      auto_refresh_policy: {
        auto_refresh_allowed: false,
        minimum_refresh_interval: {
          value: 45,
          unit: 'seconds',
        },
      },
    },
    expected: {},
    readPolicy: null,
  },
  {
    name: "standard boundary 'yes' switch counts as allowed",
    metadata: {
      auto_refresh_policy: {
        auto_refresh_allowed: 'yes',
        minimum_refresh_interval: {
          value: 45,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.auto_refresh_allowed': {
        code: 'invalid_policy',
        message: 'Must be true or false.',
      },
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message:
          "45 seconds isn't a standard interval. Select one from the list.",
      },
    },
    readPolicy: null,
  },
  {
    name: 'changed? {60,seconds} vs stored {1,minutes} (list w/o 60)',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 60,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message:
          "60 seconds isn't a standard interval. Select one from the list.",
      },
    },
    readPolicy: {
      minimum_refresh_interval: {
        value: 1,
        unit: 'minutes',
      },
    },
    adminList: [
      [0, "Don't refresh"],
      [10, '10 seconds'],
      [30, '30 seconds'],
      [300, '5 minutes'],
      [3600, '1 hour'],
    ],
  },
  {
    name: 'changed? key order only (list w/o 60)',
    metadata: {
      auto_refresh_policy: {
        auto_refresh_allowed: true,
        minimum_refresh_interval: {
          value: 1,
          unit: 'minutes',
        },
      },
    },
    expected: {},
    readPolicy: {
      minimum_refresh_interval: {
        value: 1,
        unit: 'minutes',
      },
      auto_refresh_allowed: true,
    },
    adminList: [
      [0, "Don't refresh"],
      [10, '10 seconds'],
      [30, '30 seconds'],
      [300, '5 minutes'],
      [3600, '1 hour'],
    ],
  },
  {
    name: '60 s and 1 min are equal lengths',
    metadata: {
      refresh_frequency: 60,
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 60,
          unit: 'seconds',
        },
        maximum_refresh_interval: {
          value: 1,
          unit: 'minutes',
        },
      },
    },
    expected: {},
    readPolicy: null,
  },
  {
    name: 'bound ordering: both fields',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 1,
          unit: 'hours',
        },
        maximum_refresh_interval: {
          value: 5,
          unit: 'minutes',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'minimum_greater_than_maximum',
        message:
          'Shortest interval must be shorter than or equal to the longest interval.',
      },
      'auto_refresh_policy.maximum_refresh_interval': {
        code: 'minimum_greater_than_maximum',
        message:
          'Shortest interval must be shorter than or equal to the longest interval.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'bound ordering: while prohibited',
    metadata: {
      auto_refresh_policy: {
        auto_refresh_allowed: false,
        minimum_refresh_interval: {
          value: 1,
          unit: 'hours',
        },
        maximum_refresh_interval: {
          value: 5,
          unit: 'minutes',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'minimum_greater_than_maximum',
        message:
          'Shortest interval must be shorter than or equal to the longest interval.',
      },
      'auto_refresh_policy.maximum_refresh_interval': {
        code: 'minimum_greater_than_maximum',
        message:
          'Shortest interval must be shorter than or equal to the longest interval.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'available standard intervals: list w/o 86400, unchanged 24 h min',
    metadata: {
      refresh_frequency: 0,
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 24,
          unit: 'hours',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'no_standard_interval',
        message:
          'No standard interval fits between the shortest and longest interval. Widen the range.',
      },
    },
    readPolicy: {
      minimum_refresh_interval: {
        value: 24,
        unit: 'hours',
      },
    },
    adminList: [
      [0, "Don't refresh"],
      [10, '10 seconds'],
      [30, '30 seconds'],
      [60, '1 minute'],
      [300, '5 minutes'],
      [1800, '30 minutes'],
      [3600, '1 hour'],
      [21600, '6 hours'],
      [43200, '12 hours'],
    ],
  },
  {
    name: 'available standard intervals: same but prohibited',
    metadata: {
      refresh_frequency: 0,
      auto_refresh_policy: {
        auto_refresh_allowed: false,
        minimum_refresh_interval: {
          value: 24,
          unit: 'hours',
        },
      },
    },
    expected: {},
    readPolicy: {
      auto_refresh_allowed: false,
      minimum_refresh_interval: {
        value: 24,
        unit: 'hours',
      },
    },
    adminList: [
      [0, "Don't refresh"],
      [10, '10 seconds'],
      [30, '30 seconds'],
      [60, '1 minute'],
      [300, '5 minutes'],
      [1800, '30 minutes'],
      [3600, '1 hour'],
      [21600, '6 hours'],
      [43200, '12 hours'],
    ],
  },
  {
    name: 'available standard intervals: min=max=60 s, list w/o 60, unchanged',
    metadata: {
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 60,
          unit: 'seconds',
        },
        maximum_refresh_interval: {
          value: 60,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'no_standard_interval',
        message:
          'No standard interval fits between the shortest and longest interval. Widen the range.',
      },
      'auto_refresh_policy.maximum_refresh_interval': {
        code: 'no_standard_interval',
        message:
          'No standard interval fits between the shortest and longest interval. Widen the range.',
      },
    },
    readPolicy: {
      minimum_refresh_interval: {
        value: 60,
        unit: 'seconds',
      },
      maximum_refresh_interval: {
        value: 60,
        unit: 'seconds',
      },
    },
    adminList: [
      [0, "Don't refresh"],
      [10, '10 seconds'],
      [30, '30 seconds'],
      [300, '5 minutes'],
      [3600, '1 hour'],
    ],
  },
  {
    name: 'prohibited default: prohibited 60',
    metadata: {
      refresh_frequency: 60,
      auto_refresh_policy: {
        auto_refresh_allowed: false,
      },
    },
    expected: {
      refresh_frequency: {
        code: 'auto_refresh_prohibited',
        message:
          'Auto-refresh isn\'t allowed on this dashboard. Set refresh frequency to "Don\'t refresh".',
      },
    },
    readPolicy: null,
  },
  {
    name: 'prohibited default: prohibited 0',
    metadata: {
      refresh_frequency: 0,
      auto_refresh_policy: {
        auto_refresh_allowed: false,
      },
    },
    expected: {},
    readPolicy: null,
  },
  {
    name: "default frequency type: '60'",
    metadata: {
      refresh_frequency: '60',
      auto_refresh_policy: {},
    },
    expected: {
      refresh_frequency: {
        code: 'invalid_refresh_frequency',
        message: 'Refresh frequency must be 0 or a whole number of seconds.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default frequency type: 60.5',
    metadata: {
      refresh_frequency: 60.5,
      auto_refresh_policy: {},
    },
    expected: {
      refresh_frequency: {
        code: 'invalid_refresh_frequency',
        message: 'Refresh frequency must be 0 or a whole number of seconds.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default frequency type: -5',
    metadata: {
      refresh_frequency: -5,
      auto_refresh_policy: {},
    },
    expected: {
      refresh_frequency: {
        code: 'invalid_refresh_frequency',
        message: 'Refresh frequency must be 0 or a whole number of seconds.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default frequency type: true',
    metadata: {
      refresh_frequency: true,
      auto_refresh_policy: {},
    },
    expected: {
      refresh_frequency: {
        code: 'invalid_refresh_frequency',
        message: 'Refresh frequency must be 0 or a whole number of seconds.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default frequency type: null',
    metadata: {
      refresh_frequency: null,
      auto_refresh_policy: {},
    },
    expected: {
      refresh_frequency: {
        code: 'invalid_refresh_frequency',
        message: 'Refresh frequency must be 0 or a whole number of seconds.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default frequency type: missing = 0',
    metadata: {
      auto_refresh_policy: {},
    },
    expected: {},
    readPolicy: null,
  },
  {
    name: 'standard default: 45 no bounds',
    metadata: {
      refresh_frequency: 45,
      auto_refresh_policy: {},
    },
    expected: {
      refresh_frequency: {
        code: 'custom_not_allowed',
        message: 'Refresh frequency must be one of the standard intervals.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'defaults 60 ok',
    metadata: {
      refresh_frequency: 60,
      auto_refresh_policy: {},
    },
    expected: {},
    readPolicy: null,
  },
  {
    name: 'default within bounds: below',
    metadata: {
      refresh_frequency: 30,
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 1,
          unit: 'minutes',
        },
      },
    },
    expected: {
      refresh_frequency: {
        code: 'below_minimum',
        message: 'Refresh frequency must be 1 minute or greater.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default within bounds: above',
    metadata: {
      refresh_frequency: 86400,
      auto_refresh_policy: {
        maximum_refresh_interval: {
          value: 1,
          unit: 'hours',
        },
      },
    },
    expected: {
      refresh_frequency: {
        code: 'above_maximum',
        message: 'Refresh frequency must be 1 hour or less.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default within bounds: below plural 30 seconds',
    metadata: {
      refresh_frequency: 10,
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 30,
          unit: 'seconds',
        },
      },
    },
    expected: {
      refresh_frequency: {
        code: 'below_minimum',
        message: 'Refresh frequency must be 30 seconds or greater.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default within bounds: stale min still bounds',
    metadata: {
      refresh_frequency: 30,
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 45,
          unit: 'seconds',
        },
      },
    },
    expected: {
      refresh_frequency: {
        code: 'below_minimum',
        message: 'Refresh frequency must be 45 seconds or greater.',
      },
    },
    readPolicy: {
      minimum_refresh_interval: {
        value: 45,
        unit: 'seconds',
      },
    },
  },
  {
    name: 'default within bounds: below 1 hour singular',
    metadata: {
      refresh_frequency: 1800,
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 1,
          unit: 'hours',
        },
      },
    },
    expected: {
      refresh_frequency: {
        code: 'below_minimum',
        message: 'Refresh frequency must be 1 hour or greater.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default within bounds: not checked against invalid bound',
    metadata: {
      refresh_frequency: 10,
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 0,
          unit: 'hours',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message: 'Use a whole number of seconds, minutes or hours.',
      },
    },
    readPolicy: null,
  },
  {
    name: 'default within bounds: standard boundary changed + skipped on that bound',
    metadata: {
      refresh_frequency: 30,
      auto_refresh_policy: {
        minimum_refresh_interval: {
          value: 45,
          unit: 'seconds',
        },
      },
    },
    expected: {
      'auto_refresh_policy.minimum_refresh_interval': {
        code: 'invalid_boundary',
        message:
          "45 seconds isn't a standard interval. Select one from the list.",
      },
    },
    readPolicy: null,
  },
  {
    name: 'standard default: empty positive list: on any >0',
    metadata: {
      refresh_frequency: 300,
      auto_refresh_policy: {},
    },
    expected: {
      auto_refresh_policy: {
        code: 'no_standard_interval',
        message:
          'No standard interval fits between the shortest and longest interval. Widen the range.',
      },
      refresh_frequency: {
        code: 'custom_not_allowed',
        message: 'Refresh frequency must be one of the standard intervals.',
      },
    },
    readPolicy: null,
    adminList: [[0, "Don't refresh"]],
  },
];

test.each(SERVER_CASES.map(c => [c.name, c] as const))(
  'getRefreshPolicyErrors matches check_refresh_policy: %s',
  (_, { metadata, readPolicy, adminList, expected }) => {
    expect(
      getRefreshPolicyErrors(metadata, readPolicy, adminList ?? DEFAULT_LIST),
    ).toEqual(expected);
  },
);

test('getRefreshPolicyErrors: true vs 1 counts as changed on the client (stricter than the server)', () => {
  const listWithout60 = [
    [0, "Don't refresh"],
    [10, '10 seconds'],
    [30, '30 seconds'],
    [300, '5 minutes'],
    [3600, '1 hour'],
  ];
  expect(
    getRefreshPolicyErrors(
      {
        auto_refresh_policy: {
          auto_refresh_allowed: 1,
          minimum_refresh_interval: { value: 1, unit: 'minutes' },
        },
      },
      {
        auto_refresh_allowed: true,
        minimum_refresh_interval: { value: 1, unit: 'minutes' },
      },
      listWithout60,
    ),
  ).toEqual({
    'auto_refresh_policy.auto_refresh_allowed': {
      code: 'invalid_policy',
      message: 'Must be true or false.',
    },
    'auto_refresh_policy.minimum_refresh_interval': {
      code: 'invalid_boundary',
      message: "1 minute isn't a standard interval. Select one from the list.",
    },
  });
});

test('getRefreshPolicyErrors: a non-whole admin value is not a standard interval on the client (stricter than the server)', () => {
  const bounds = {
    minimum_refresh_interval: { value: 1, unit: 'seconds' },
    maximum_refresh_interval: { value: 2, unit: 'seconds' },
  };
  const message =
    'No standard interval fits between the shortest and longest interval. Widen the range.';
  expect(
    getRefreshPolicyErrors(
      { refresh_frequency: 0, auto_refresh_policy: bounds },
      bounds,
      [
        [0, "Don't refresh"],
        [1.5, 'odd'],
        [300, '5 minutes'],
      ],
    ),
  ).toEqual({
    'auto_refresh_policy.minimum_refresh_interval': {
      code: 'no_standard_interval',
      message,
    },
    'auto_refresh_policy.maximum_refresh_interval': {
      code: 'no_standard_interval',
      message,
    },
  });
});

test('getRefreshPolicyErrors: no policy or a null policy checks nothing', () => {
  expect(getRefreshPolicyErrors({ refresh_frequency: 45 }, undefined)).toEqual(
    {},
  );
  expect(
    getRefreshPolicyErrors(
      { refresh_frequency: 45, auto_refresh_policy: null },
      undefined,
    ),
  ).toEqual({});
});

test('toBound uses the largest unit that divides exactly', () => {
  expect(toBound(3600)).toEqual({ value: 1, unit: 'hours' });
  expect(toBound(300)).toEqual({ value: 5, unit: 'minutes' });
  expect(toBound(45)).toEqual({ value: 45, unit: 'seconds' });
  expect(toBound(86400)).toEqual({ value: 24, unit: 'hours' });
});

test('toBound round-trips with getBoundSeconds for every default interval', () => {
  getStandardSeconds(DEFAULT_LIST).forEach(seconds => {
    expect(getBoundSeconds(toBound(seconds))).toBe(seconds);
  });
});

test('formatBound uses the server words, singular and plural', () => {
  const cases: [RefreshBound, string][] = [
    [{ value: 1, unit: 'seconds' }, '1 second'],
    [{ value: 45, unit: 'seconds' }, '45 seconds'],
    [{ value: 1, unit: 'minutes' }, '1 minute'],
    [{ value: 5, unit: 'minutes' }, '5 minutes'],
    [{ value: 120, unit: 'minutes' }, '120 minutes'],
    [{ value: 1, unit: 'hours' }, '1 hour'],
    [{ value: 24, unit: 'hours' }, '24 hours'],
  ];
  cases.forEach(([bound, label]) => expect(formatBound(bound)).toBe(label));
});

test('getStandardSeconds keeps the positive whole admin values, as get_standard_refresh_intervals', () => {
  expect(getStandardSeconds(DEFAULT_LIST)).toEqual([
    10, 30, 60, 300, 1800, 3600, 21600, 43200, 86400,
  ]);
  expect(
    getStandardSeconds([
      [30, '30 s'],
      ['60', '1 min'],
      [30, 'dup'],
      [-5, 'bad'],
      ['', 'bad'],
      [10, ''],
    ]),
  ).toEqual([30, 60]);
  expect(getStandardSeconds([[0, "Don't refresh"]])).toEqual([]);
  expect(getStandardSeconds([])).toEqual([
    10, 30, 60, 300, 1800, 3600, 21600, 43200, 86400,
  ]);
  expect(getStandardSeconds('x')).toEqual([
    10, 30, 60, 300, 1800, 3600, 21600, 43200, 86400,
  ]);
});

test('getStandardSeconds drops non-whole admin values, matching the server', () => {
  expect(
    getStandardSeconds([
      [0, "Don't refresh"],
      [30, '30 s'],
      [1.5, 'odd'],
      [60, '1 min'],
      [60, 'again'],
    ]),
  ).toEqual([30, 60]);
});

test.each([{}, { auto_refresh_allowed: true }])(
  'an enabled unbounded policy needs a whole-second standard choice: %j',
  policy => {
    const intervals = [
      [0, "Don't refresh"],
      [0.5, 'Half second'],
    ];
    expect(getStandardSeconds(intervals)).toEqual([]);
    [undefined, policy].forEach(readPolicy => {
      expect(
        getRefreshPolicyErrors(
          { refresh_frequency: 0, auto_refresh_policy: policy },
          readPolicy,
          intervals,
        ),
      ).toEqual({
        auto_refresh_policy: {
          code: 'no_standard_interval',
          message:
            'No standard interval fits between the shortest and longest interval. Widen the range.',
        },
      });
    });
  },
);

test.each([undefined, null, { auto_refresh_allowed: false }])(
  'no whole-second choices do not invalidate an inactive policy: %j',
  policy => {
    expect(
      getRefreshPolicyErrors(
        { refresh_frequency: 0, auto_refresh_policy: policy },
        policy,
        [
          [0, "Don't refresh"],
          [0.5, 'Half second'],
        ],
      ),
    ).toEqual({});
  },
);
