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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  refreshFrequency: 60,
  onChange: jest.fn(),
  editMode: true,
  addSuccessToast: jest.fn(),
  pauseOnInactiveTab: false,
  onPauseOnInactiveTabChange: jest.fn(),
};

const setup = (
  props: Partial<typeof defaultProps> = {},
  refreshLimitConf: Record<string, unknown> = {},
) =>
  render(<RefreshIntervalModal {...defaultProps} {...props} />, {
    useRedux: true,
    initialState: {
      dashboardInfo: { common: { conf: refreshLimitConf } },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
});

test('selecting an interval and saving persists it in edit mode', async () => {
  setup();

  await userEvent.click(screen.getByRole('radio', { name: '5 minutes' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(defaultProps.onChange).toHaveBeenCalledWith(300, true);
  expect(defaultProps.onPauseOnInactiveTabChange).toHaveBeenCalledWith(false);
  expect(defaultProps.onHide).toHaveBeenCalledTimes(1);
  expect(defaultProps.addSuccessToast).toHaveBeenCalledWith(
    'Refresh interval saved',
  );
});

test('saving outside edit mode reports a session-only save', async () => {
  setup({ editMode: false });

  await userEvent.click(
    screen.getByRole('button', { name: 'Save for this session' }),
  );

  expect(defaultProps.onChange).toHaveBeenCalledWith(60, false);
  expect(defaultProps.addSuccessToast).toHaveBeenCalledWith(
    'Refresh interval set for this session',
  );
});

test('an interval below the configured limit blocks save with an error', async () => {
  setup({}, { SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT: 60 });

  await userEvent.click(screen.getByRole('radio', { name: '10 seconds' }));

  expect(
    screen.getByText('Refresh frequency must be at least 60 seconds'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(defaultProps.onChange).not.toHaveBeenCalled();
});

test('an interval at or above the configured limit does not block save', async () => {
  setup({}, { SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT: 60 });

  await userEvent.click(screen.getByRole('radio', { name: '5 minutes' }));

  expect(
    screen.queryByText(/Refresh frequency must be at least/),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('cancel resets the selection back to the original frequency and does not save', async () => {
  // defaultProps.refreshFrequency (60) maps to the "1 minute" preset.
  setup();
  expect(screen.getByRole('radio', { name: '1 minute' })).toBeChecked();

  await userEvent.click(screen.getByRole('radio', { name: '1 hour' }));
  expect(screen.getByRole('radio', { name: '1 hour' })).toBeChecked();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(defaultProps.onChange).not.toHaveBeenCalled();
  expect(defaultProps.onHide).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('radio', { name: '1 minute' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '1 hour' })).not.toBeChecked();
});
