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
import { render, screen } from 'spec/helpers/testing-library';
import {
  getRefreshWarningMessage,
  RefreshFrequencySelect,
  validateRefreshFrequency,
} from './RefreshFrequencySelect';

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

const mockConfiguredIntervals: [number, string][] = [
  [0, "Don't refresh"],
  [15, '15 seconds'],
  [45, '45 seconds'],
  [90, '90 seconds'],
];

const createInitialState = (
  intervals?: [number, string][],
  extraConf?: Record<string, unknown>,
) => ({
  dashboardInfo: {
    common: {
      conf: {
        ...(intervals !== undefined
          ? { DASHBOARD_AUTO_REFRESH_INTERVALS: intervals }
          : {}),
        ...extraConf,
      },
    },
  },
});

const defaultTestProps = {
  value: 0,
  onChange: jest.fn(),
};

const setup = (
  props: Partial<typeof defaultTestProps> = {},
  initialState?: object,
) =>
  render(<RefreshFrequencySelect {...defaultTestProps} {...props} />, {
    useRedux: true,
    ...(initialState ? { initialState } : {}),
  });

test('renders configured auto refresh intervals from redux store', () => {
  setup({}, createInitialState(mockConfiguredIntervals));

  expect(screen.getByRole('radio', { name: '15 seconds' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '45 seconds' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '90 seconds' })).toBeInTheDocument();
  expect(
    screen.queryByRole('radio', { name: '10 seconds' }),
  ).not.toBeInTheDocument();
});

test('renders default options when config is not present', () => {
  setup({}, createInitialState(undefined));

  expect(
    screen.getByRole('radio', { name: "Don't refresh" }),
  ).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '10 seconds' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '30 seconds' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '1 minute' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '24 hours' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /Custom/i })).toBeInTheDocument();
});

test('renders default options when configured intervals is empty array', () => {
  setup({}, createInitialState([]));

  expect(screen.getByRole('radio', { name: '10 seconds' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '30 seconds' })).toBeInTheDocument();
});

test('options prop takes precedence over redux store configured intervals', () => {
  const propOptions: [number, string][] = [
    [5, '5 seconds'],
    [25, '25 seconds'],
  ];

  setup({ options: propOptions }, createInitialState(mockConfiguredIntervals));

  expect(screen.getByRole('radio', { name: '5 seconds' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '25 seconds' })).toBeInTheDocument();
  expect(
    screen.queryByRole('radio', { name: '15 seconds' }),
  ).not.toBeInTheDocument();
});
