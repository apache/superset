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
import {
  CUSTOM_REFRESH_FREQUENCY,
  getRefreshFrequencyOptions,
  getRefreshWarningMessage,
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
