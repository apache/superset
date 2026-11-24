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
import configureMockStore from 'redux-mock-store';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { COMMON_RANGE_OPTIONS } from 'src/explore/components/controls/DateFilterControl/utils';
import { CommonFrame } from './CommonFrame';

const mockStore = configureMockStore([]);

const DEFAULT_RANGE_NAMES = COMMON_RANGE_OPTIONS.map(
  option => option.value as string,
);
const CUSTOM_PRESETS = ['Last 5 minutes', 'Last 2 hours'];

// CommonFrame reads `state.dashboardInfo.metadata.custom_time_presets`
// via useSelector, so it must always be rendered inside a redux Provider.
const renderCommonFrame = ({
  value,
  onChange = jest.fn(),
  customTimePresets,
  withDashboardInfo = true,
}: {
  value: string;
  onChange?: jest.Mock;
  customTimePresets?: string[];
  withDashboardInfo?: boolean;
}) => {
  const state = withDashboardInfo
    ? {
        dashboardInfo: {
          metadata:
            customTimePresets !== undefined
              ? { custom_time_presets: customTimePresets }
              : {},
        },
      }
    : {};
  render(<CommonFrame value={value} onChange={onChange} />, {
    store: mockStore(state),
  });
  return { onChange };
};

test('renders default options when dashboardInfo is undefined', () => {
  const { onChange } = renderCommonFrame({
    value: 'Last week',
    withDashboardInfo: false,
  });

  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(DEFAULT_RANGE_NAMES.length);
  DEFAULT_RANGE_NAMES.forEach((name, index) => {
    expect(radios[index]).toHaveAccessibleName(name);
  });
  expect(screen.getByLabelText('Last week')).toBeChecked();
  expect(onChange).not.toHaveBeenCalled();
});

test('appends custom_time_presets to the default options', () => {
  renderCommonFrame({
    value: 'Last week',
    customTimePresets: CUSTOM_PRESETS,
  });

  const radios = screen.getAllByRole('radio');
  const expectedNames = [...DEFAULT_RANGE_NAMES, ...CUSTOM_PRESETS];
  expect(radios).toHaveLength(expectedNames.length);
  // Defaults come first, custom presets are appended in configured order
  expectedNames.forEach((name, index) => {
    expect(radios[index]).toHaveAccessibleName(name);
  });
});

test('preserves a configured custom preset value on render', () => {
  const { onChange } = renderCommonFrame({
    value: 'Last 5 minutes',
    customTimePresets: CUSTOM_PRESETS,
  });

  // The custom value is recognised, so it is neither reset nor replaced
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Last 5 minutes')).toBeChecked();
  expect(screen.getByLabelText('Last week')).not.toBeChecked();
  // Custom options are still rendered alongside the defaults
  expect(screen.getAllByRole('radio')).toHaveLength(
    DEFAULT_RANGE_NAMES.length + CUSTOM_PRESETS.length,
  );
});

test('resets to the default range when the value is not a configured preset', () => {
  const { onChange } = renderCommonFrame({
    // Valid-looking relative range, but not configured on this dashboard
    value: 'Last 7 minutes',
    customTimePresets: CUSTOM_PRESETS,
  });

  expect(onChange).toHaveBeenCalledWith('Last week');
  expect(screen.getByLabelText('Last week')).toBeChecked();
  expect(screen.queryByLabelText('Last 7 minutes')).not.toBeInTheDocument();
});

test('resets a custom preset value to the default when no presets are configured', () => {
  const { onChange } = renderCommonFrame({
    value: 'Last 5 minutes',
    withDashboardInfo: false,
  });

  expect(onChange).toHaveBeenCalledWith('Last week');
  expect(screen.getByLabelText('Last week')).toBeChecked();
});

test('calls onChange when a custom preset option is selected', async () => {
  const { onChange } = renderCommonFrame({
    value: 'Last week',
    customTimePresets: CUSTOM_PRESETS,
  });

  await userEvent.click(screen.getByLabelText('Last 2 hours'));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('Last 2 hours');
});
