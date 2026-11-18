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
import { t } from '@apache-superset/core/translation';
import { useState } from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import {
  CUSTOM_REFRESH_FREQUENCY,
  getAllowedRefreshOptions,
  getBoundSeconds,
  getCustomValue,
  getEffectiveRefreshFrequency,
  getRefreshFrequencyOptions,
  getRefreshWarningMessage,
  isPresetValue,
  RefreshFrequencySelect,
  REFRESH_FREQUENCY_OPTIONS,
  validateRefreshFrequency,
} from './RefreshFrequencySelect';

// No language pack is loaded in tests, so t() is the identity function. Mock
// it with jest.fn so a test can register a translation and observe it. The
// default lives in a hoisted function declaration: the factory runs before
// module-level bindings initialize (transitive imports call t() at load time).
function mockTranslate(str: string, ...args: unknown[]): string {
  return str.replace(/%s/g, () => String(args.shift()));
}

jest.mock('@apache-superset/core/translation', () => ({
  ...jest.requireActual('@apache-superset/core/translation'),
  t: jest.fn(mockTranslate),
}));

test('validateRefreshFrequency treats millisecond refreshLimit as seconds', () => {
  const errors = validateRefreshFrequency(5, 10000);

  expect(errors[0]).toContain('10');
});

test('validateRefreshFrequency treats second refreshLimit as seconds', () => {
  const errors = validateRefreshFrequency(5, 10);

  expect(errors[0]).toContain('10');
});

test('getRefreshWarningMessage normalizes refreshLimit', () => {
  expect(getRefreshWarningMessage(5, 10000, 'warn')).toBe('warn');
  expect(getRefreshWarningMessage(5, 10, 'warn')).toBe('warn');
  expect(getRefreshWarningMessage(15, 10000, 'warn')).toBeNull();
});

test('getRefreshFrequencyOptions honours the configured intervals', () => {
  const options = getRefreshFrequencyOptions([
    [0, "Don't refresh"],
    [600, '10 minutes'],
    [1800, '30 minutes'],
    [3600, '1 hour'],
  ]);

  expect(options).toEqual([
    { value: 0, label: "Don't refresh" },
    { value: 600, label: '10 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
    { value: CUSTOM_REFRESH_FREQUENCY, label: 'Custom' },
  ]);
});

test('getRefreshFrequencyOptions falls back to the built-in list when the config is absent', () => {
  expect(getRefreshFrequencyOptions(undefined)).toEqual(
    REFRESH_FREQUENCY_OPTIONS,
  );
  expect(getRefreshFrequencyOptions([])).toEqual(REFRESH_FREQUENCY_OPTIONS);
  expect(getRefreshFrequencyOptions('10 seconds')).toEqual(
    REFRESH_FREQUENCY_OPTIONS,
  );
});

test('getRefreshFrequencyOptions drops malformed entries instead of rendering them', () => {
  const options = getRefreshFrequencyOptions([
    [600],
    ['not-a-number', 'Ten minutes'],
    [-5, 'Negative'],
    [1800, '   '],
    [1800, null],
    [3600, '1 hour'],
  ]);

  expect(options).toEqual([
    { value: 3600, label: '1 hour' },
    { value: CUSTOM_REFRESH_FREQUENCY, label: 'Custom' },
  ]);
});

test('getRefreshFrequencyOptions localizes labels with a translation and passes the rest through', () => {
  const tMock = jest.mocked(t);
  tMock.mockImplementation((str: string, ...args: unknown[]) =>
    str === '10 seconds' ? '10 Sekunden' : mockTranslate(str, ...args),
  );
  try {
    const options = getRefreshFrequencyOptions([
      [10, '10 seconds'],
      [600, '10 Minuten'],
    ]);

    expect(options).toEqual([
      { value: 10, label: '10 Sekunden' },
      { value: 600, label: '10 Minuten' },
      { value: CUSTOM_REFRESH_FREQUENCY, label: 'Custom' },
    ]);
  } finally {
    tMock.mockImplementation(mockTranslate);
  }
});

test('getRefreshFrequencyOptions drops a configured Custom entry and appends exactly one', () => {
  // CUSTOM_REFRESH_FREQUENCY is negative, so the seconds < 0 guard drops it;
  // the list always ends with the single built-in Custom affordance.
  const options = getRefreshFrequencyOptions([
    [600, '10 minutes'],
    [CUSTOM_REFRESH_FREQUENCY, 'Custom'],
  ]);

  expect(options).toEqual([
    { value: 600, label: '10 minutes' },
    { value: CUSTOM_REFRESH_FREQUENCY, label: 'Custom' },
  ]);
});

test('getRefreshFrequencyOptions rejects values that coerce to a real interval', () => {
  // Number(null), Number('') and Number([]) are all 0, and 0 is the "Don't
  // refresh" interval, so a loose conversion would smuggle them in as valid.
  const options = getRefreshFrequencyOptions([
    [null, 'Nothing'],
    ['', 'Empty'],
    [[], 'Array'],
    [true, 'Boolean'],
    [{}, 'Object'],
    [600, '10 minutes'],
  ]);

  expect(options).toEqual([
    { value: 600, label: '10 minutes' },
    { value: CUSTOM_REFRESH_FREQUENCY, label: 'Custom' },
  ]);
});

test('getRefreshFrequencyOptions keeps the first of two entries sharing an interval', () => {
  // Duplicate React keys and two simultaneously-checked radios otherwise.
  const options = getRefreshFrequencyOptions([
    [600, 'Ten minutes'],
    [600, 'Another ten minutes'],
    ['600', 'A string spelling the same interval'],
  ]);

  expect(options).toEqual([
    { value: 600, label: 'Ten minutes' },
    { value: CUSTOM_REFRESH_FREQUENCY, label: 'Custom' },
  ]);
});

const INTERVALS = [
  [0, "Don't refresh"],
  [600, '10 minutes'],
  [3600, '1 hour'],
];

test('the configured intervals are read from the bootstrapped store when no dashboard is hydrated', () => {
  // The select also mounts from the Dashboard List / Home pages, where only
  // the bootstrapped state.common carries the deployment config.
  render(<RefreshFrequencySelect value={0} onChange={jest.fn()} />, {
    useRedux: true,
    initialState: {
      common: { conf: { DASHBOARD_AUTO_REFRESH_INTERVALS: INTERVALS } },
    },
  });

  expect(screen.getByRole('radio', { name: '10 minutes' })).toBeInTheDocument();
  expect(
    screen.queryByRole('radio', { name: '10 seconds' }),
  ).not.toBeInTheDocument();
});

test('the hydrated dashboard config wins over the bootstrapped one', () => {
  render(<RefreshFrequencySelect value={0} onChange={jest.fn()} />, {
    useRedux: true,
    initialState: {
      dashboardInfo: {
        common: {
          conf: {
            DASHBOARD_AUTO_REFRESH_INTERVALS: [
              [0, "Don't refresh"],
              [600, '10 minutes'],
            ],
          },
        },
      },
      common: { conf: { DASHBOARD_AUTO_REFRESH_INTERVALS: INTERVALS } },
    },
  });

  expect(screen.getByRole('radio', { name: '10 minutes' })).toBeInTheDocument();
  expect(
    screen.queryByRole('radio', { name: '1 hour' }),
  ).not.toBeInTheDocument();
});

// A parent that feeds every emitted value straight back, the way
// PropertiesModal and RefreshIntervalModal hold the selection in their own
// state.
function ControlledSelect({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(initialValue);
  return <RefreshFrequencySelect value={value} onChange={setValue} />;
}

test('Custom stays selected when the emitted value collides with a preset', async () => {
  // Regression: an interval list containing 1 (e.g. [1, '1 second']) made the
  // first Custom click emit onChange(1), the parent echo that back as value=1,
  // and the sync effect re-derive the selection from preset membership --
  // landing on the 1 second preset with a cleared, disabled input.
  render(<ControlledSelect initialValue={0} />, {
    useRedux: true,
    initialState: {
      common: {
        conf: {
          DASHBOARD_AUTO_REFRESH_INTERVALS: [
            [0, "Don't refresh"],
            [1, '1 second'],
            [600, '10 minutes'],
          ],
        },
      },
    },
  });

  await userEvent.click(screen.getByRole('radio', { name: /Custom/i }));

  expect(screen.getByRole('radio', { name: '1 second' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: /Custom/i })).toBeChecked();

  const customInput = screen.getByRole('spinbutton');
  expect(customInput).toBeEnabled();
  expect(customInput).toHaveValue(1);
});

test('typing a preset-colliding value into the Custom input keeps Custom selected', async () => {
  render(<ControlledSelect initialValue={0} />, {
    useRedux: true,
    initialState: {
      common: {
        conf: {
          DASHBOARD_AUTO_REFRESH_INTERVALS: [
            [0, "Don't refresh"],
            [600, '10 minutes'],
          ],
        },
      },
    },
  });

  await userEvent.click(screen.getByRole('radio', { name: /Custom/i }));
  await userEvent.type(screen.getByRole('spinbutton'), '{backspace}600');

  expect(screen.getByRole('radio', { name: /Custom/i })).toBeChecked();
  expect(screen.getByRole('radio', { name: '10 minutes' })).not.toBeChecked();
  expect(screen.getByRole('spinbutton')).toHaveValue(600);
});

test('selecting a preset still snaps selection to that preset', async () => {
  render(<ControlledSelect initialValue={0} />, {
    useRedux: true,
    initialState: {
      common: {
        conf: {
          DASHBOARD_AUTO_REFRESH_INTERVALS: [
            [0, "Don't refresh"],
            [1, '1 second'],
            [600, '10 minutes'],
          ],
        },
      },
    },
  });

  await userEvent.click(screen.getByRole('radio', { name: /Custom/i }));
  await userEvent.click(screen.getByRole('radio', { name: '1 second' }));

  expect(screen.getByRole('radio', { name: '1 second' })).toBeChecked();
  expect(screen.getByRole('radio', { name: /Custom/i })).not.toBeChecked();
  expect(screen.getByRole('spinbutton')).toBeDisabled();
});

test('isPresetValue and getCustomValue work with default and custom options', () => {
  expect(isPresetValue(10)).toBe(true);
  expect(isPresetValue(42)).toBe(false);
  expect(isPresetValue(CUSTOM_REFRESH_FREQUENCY)).toBe(false);

  expect(getCustomValue(10)).toBe('');
  expect(getCustomValue(0)).toBe('');
  expect(getCustomValue(42)).toBe('42');
});

test('uses options prop override when provided', () => {
  const propOptions: [number, string][] = [
    [0, "Don't refresh"],
    [5, '5 seconds'],
    [25, '25 seconds'],
  ];

  render(
    <RefreshFrequencySelect
      value={0}
      onChange={jest.fn()}
      options={propOptions}
    />,
    {
      useRedux: true,
      initialState: {
        common: { conf: { DASHBOARD_AUTO_REFRESH_INTERVALS: INTERVALS } },
      },
    },
  );

  expect(screen.getByRole('radio', { name: '5 seconds' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '25 seconds' })).toBeInTheDocument();
  expect(
    screen.queryByRole('radio', { name: '10 minutes' }),
  ).not.toBeInTheDocument();
});

test('preserves previously entered custom value when switching between preset and custom', async () => {
  render(<ControlledSelect initialValue={0} />, {
    useRedux: true,
    initialState: {
      common: { conf: { DASHBOARD_AUTO_REFRESH_INTERVALS: INTERVALS } },
    },
  });

  const customRadio = screen.getByRole('radio', { name: /Custom/i });
  const presetRadio = screen.getByRole('radio', { name: '10 minutes' });
  const input = screen.getByRole('spinbutton');

  await userEvent.click(customRadio);
  fireEvent.change(input, { target: { value: '120' } });
  expect(input).toHaveValue(120);

  await userEvent.click(presetRadio);
  expect(presetRadio).toBeChecked();
  expect(input).toBeDisabled();

  await userEvent.click(customRadio);
  expect(customRadio).toBeChecked();
  expect(input).toBeEnabled();
  expect(input).toHaveValue(120);
});

test('clamps custom draft below minimum interval when switching preset to custom', async () => {
  render(<ControlledSelect initialValue={0} />, {
    useRedux: true,
    initialState: {
      common: { conf: { DASHBOARD_AUTO_REFRESH_INTERVALS: INTERVALS } },
    },
  });

  const customRadio = screen.getByRole('radio', { name: /Custom/i });
  const presetRadio = screen.getByRole('radio', { name: '10 minutes' });
  const input = screen.getByRole('spinbutton');

  await userEvent.click(customRadio);
  fireEvent.change(input, { target: { value: '-5' } });
  expect(input).toHaveValue(-5);

  await userEvent.click(presetRadio);
  expect(presetRadio).toBeChecked();
  expect(input).toBeDisabled();

  await userEvent.click(customRadio);
  expect(customRadio).toBeChecked();
  expect(input).toBeEnabled();
  expect(input).toHaveValue(1);
});

const ADMIN_LIST = [
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

const allowedValues = (policy: unknown, intervals: unknown = ADMIN_LIST) =>
  getAllowedRefreshOptions(policy, intervals).map(({ value }) => value);

test.each([
  [
    'allowed, no bounds',
    { auto_refresh_allowed: true },
    ADMIN_LIST,
    [0, 10, 30, 60, 300, 1800, 3600, 21600, 43200, 86400],
  ],
  [
    '30 seconds to 1 hour',
    {
      auto_refresh_allowed: true,
      minimum_refresh_interval: { value: 30, unit: 'seconds' },
      maximum_refresh_interval: { value: 1, unit: 'hours' },
    },
    ADMIN_LIST,
    [0, 30, 60, 300, 1800, 3600],
  ],
  ['prohibited', { auto_refresh_allowed: false }, ADMIN_LIST, []],
  [
    'only a minimum of 1 minute',
    {
      auto_refresh_allowed: true,
      minimum_refresh_interval: { value: 1, unit: 'minutes' },
    },
    ADMIN_LIST,
    [0, 60, 300, 1800, 3600, 21600, 43200, 86400],
  ],
  [
    'only a maximum of 5 minutes',
    {
      auto_refresh_allowed: true,
      maximum_refresh_interval: { value: 5, unit: 'minutes' },
    },
    ADMIN_LIST,
    [0, 10, 30, 60, 300],
  ],
  [
    'admin list without 60, bounds 60 seconds to 1 hour',
    {
      auto_refresh_allowed: true,
      minimum_refresh_interval: { value: 60, unit: 'seconds' },
      maximum_refresh_interval: { value: 1, unit: 'hours' },
    },
    ADMIN_LIST.filter(([value]) => value !== 60),
    [0, 300, 1800, 3600],
  ],
  [
    'minimum of 2 hours left the list, rounds up to 6 hours',
    {
      auto_refresh_allowed: true,
      minimum_refresh_interval: { value: 2, unit: 'hours' },
    },
    [
      [3600, '1 hour'],
      [21600, '6 hours'],
    ],
    [0, 21600],
  ],
  [
    'maximum of 2 hours left the list, rounds down to 1 hour',
    {
      auto_refresh_allowed: true,
      maximum_refresh_interval: { value: 2, unit: 'hours' },
    },
    [
      [3600, '1 hour'],
      [21600, '6 hours'],
    ],
    [0, 3600],
  ],
  [
    'minimum of 24 hours on a list without it',
    {
      auto_refresh_allowed: true,
      minimum_refresh_interval: { value: 24, unit: 'hours' },
    },
    ADMIN_LIST.filter(([value]) => value !== 86400),
    [0],
  ],
  [
    'admin list without 0 still offers "Don\'t refresh"',
    {
      auto_refresh_allowed: true,
      maximum_refresh_interval: { value: 1, unit: 'minutes' },
    },
    [
      [30, '30 seconds'],
      [60, '1 minute'],
      [300, '5 minutes'],
    ],
    [0, 30, 60],
  ],
  [
    'admin list with 1.5 seconds drops the non-whole value',
    { auto_refresh_allowed: true },
    [
      [0, "Don't refresh"],
      [1.5, '1.5 seconds'],
      [60, '1 minute'],
    ],
    [0, 60],
  ],
  [
    'malformed bound is ignored',
    {
      auto_refresh_allowed: true,
      minimum_refresh_interval: { value: '30', unit: 'seconds' },
    },
    ADMIN_LIST,
    [0, 10, 30, 60, 300, 1800, 3600, 21600, 43200, 86400],
  ],
  [
    'minimum greater than maximum leaves only "Don\'t refresh"',
    {
      auto_refresh_allowed: true,
      minimum_refresh_interval: { value: 1, unit: 'hours' },
      maximum_refresh_interval: { value: 5, unit: 'minutes' },
    },
    ADMIN_LIST,
    [0],
  ],
])(
  'getAllowedRefreshOptions matches the server: %s',
  (_, policy, intervals, expected) => {
    expect(allowedValues(policy, intervals)).toEqual(expected);
  },
);

test('getAllowedRefreshOptions without a policy keeps the existing list with Custom', () => {
  expect(getAllowedRefreshOptions(undefined, ADMIN_LIST)).toEqual(
    getRefreshFrequencyOptions(ADMIN_LIST),
  );
  expect(allowedValues(null)).toContain(CUSTOM_REFRESH_FREQUENCY);
});

test('getAllowedRefreshOptions fails closed on a policy that is not an object', () => {
  expect(allowedValues('allowed')).toEqual([]);
  expect(allowedValues([])).toEqual([]);
  expect(allowedValues(true)).toEqual([]);
});

test('getAllowedRefreshOptions never offers Custom with a policy', () => {
  expect(allowedValues({})).not.toContain(CUSTOM_REFRESH_FREQUENCY);
});

test('getAllowedRefreshOptions adds a "Don\'t refresh" label when the admin list has no 0', () => {
  expect(getAllowedRefreshOptions({}, [[60, '1 minute']])).toEqual([
    { value: 0, label: "Don't refresh" },
    { value: 60, label: '1 minute' },
  ]);
});

test.each([
  ['30 seconds', { value: 30, unit: 'seconds' }, 30],
  ['1 minute', { value: 1, unit: 'minutes' }, 60],
  ['2 hours', { value: 2, unit: 'hours' }, 7200],
  ['an extra key', { value: 30, unit: 'seconds', label: 'x' }, null],
  ['a missing unit', { value: 30 }, null],
  ['value true', { value: true, unit: 'seconds' }, null],
  ['value "30"', { value: '30', unit: 'seconds' }, null],
  ['value 0', { value: 0, unit: 'seconds' }, null],
  ['value 1.5', { value: 1.5, unit: 'minutes' }, null],
  ['unit days', { value: 1, unit: 'days' }, null],
  ['unit toString', { value: 1, unit: 'toString' }, null],
  ['null', null, null],
  ['an array', [30, 'seconds'], null],
])('getBoundSeconds reads %s like the server', (_, bound, expected) => {
  expect(getBoundSeconds(bound)).toBe(expected);
});

test('getEffectiveRefreshFrequency keeps any value without a policy', () => {
  const noPolicy = getAllowedRefreshOptions(undefined, ADMIN_LIST);

  expect(getEffectiveRefreshFrequency(45, noPolicy)).toBe(45);
  expect(getEffectiveRefreshFrequency(60, noPolicy)).toBe(60);
});

test('getEffectiveRefreshFrequency falls back to 0 outside the policy', () => {
  const policyOptions = getAllowedRefreshOptions(
    {
      minimum_refresh_interval: { value: 30, unit: 'seconds' },
      maximum_refresh_interval: { value: 1, unit: 'hours' },
    },
    ADMIN_LIST,
  );
  const prohibited = getAllowedRefreshOptions(
    { auto_refresh_allowed: false },
    ADMIN_LIST,
  );

  expect(getEffectiveRefreshFrequency(300, policyOptions)).toBe(300);
  expect(getEffectiveRefreshFrequency(0, policyOptions)).toBe(0);
  expect(getEffectiveRefreshFrequency(10, policyOptions)).toBe(0);
  expect(getEffectiveRefreshFrequency(45, policyOptions)).toBe(0);
  expect(getEffectiveRefreshFrequency(60, prohibited)).toBe(0);
});

test('Custom is shown by default', () => {
  render(<RefreshFrequencySelect value={0} onChange={jest.fn()} />, {
    useRedux: true,
  });

  expect(screen.getByRole('radio', { name: /Custom/ })).toBeInTheDocument();
});

test('showCustom={false} leaves the Custom radio out', () => {
  render(
    <RefreshFrequencySelect
      value={0}
      onChange={jest.fn()}
      options={[
        [0, "Don't refresh"],
        [60, '1 minute'],
      ]}
      showCustom={false}
    />,
    { useRedux: true },
  );

  expect(
    screen
      .getAllByRole('radio')
      .map(radio => radio.closest('label')?.textContent),
  ).toEqual(["Don't refresh", '1 minute']);
  expect(
    screen.queryByRole('radio', { name: /Custom/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
});
