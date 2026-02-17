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
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled } from '@superset-ui/core';
import { SupersetClient } from '@superset-ui/core/connection';
import TranslatableTextControl from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('@superset-ui/core/connection', () => ({
  ...jest.requireActual('@superset-ui/core/connection'),
  SupersetClient: {
    get: jest.fn(),
  },
}));

const mockLocalesResponse = {
  json: {
    result: {
      locales: [
        { code: 'en', name: 'English' },
        { code: 'de', name: 'Deutsch' },
        { code: 'fr', name: 'Fran\u00e7ais' },
      ],
      default_locale: 'en',
    },
  },
};

const mockSetControlValue = jest.fn();

const baseProps = {
  name: 'x_axis_title',
  label: 'X Axis Title',
  value: 'Revenue',
  onChange: jest.fn(),
  actions: { setControlValue: mockSetControlValue },
  formData: {
    datasource: '1__table',
    viz_type: 'echarts_timeseries',
    x_axis_title: 'Revenue',
    translations: {
      x_axis_title: { de: 'Umsatz', fr: 'Revenu' },
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockLocalesResponse);
});

test('renders as plain TextControl when feature flag is off', () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(false);
  render(<TranslatableTextControl {...baseProps} />, {
    useRedux: true,
    initialState: { common: { locale: 'en' } },
  });
  expect(screen.getByDisplayValue('Revenue')).toBeInTheDocument();
  expect(
    screen.queryByLabelText(/Locale switcher/i),
  ).not.toBeInTheDocument();
});

test('renders LocaleSwitcher when feature flag is on', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  render(<TranslatableTextControl {...baseProps} />, {
    useRedux: true,
    initialState: { common: { locale: 'en' } },
  });
  expect(
    await screen.findByLabelText(/Locale switcher/i),
  ).toBeInTheDocument();
});

test('shows translation value when locale is switched to de', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  render(<TranslatableTextControl {...baseProps} />, {
    useRedux: true,
    initialState: { common: { locale: 'en' } },
  });
  const switcher = await screen.findByLabelText(/Locale switcher/i);
  await userEvent.click(switcher);
  const deOption = await screen.findByText('Deutsch');
  await userEvent.click(deOption);
  expect(screen.getByDisplayValue('Umsatz')).toBeInTheDocument();
});

test('writes translation via setControlValue when editing in locale mode', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  render(<TranslatableTextControl {...baseProps} />, {
    useRedux: true,
    initialState: { common: { locale: 'en' } },
  });
  const switcher = await screen.findByLabelText(/Locale switcher/i);
  await userEvent.click(switcher);
  const deOption = await screen.findByText('Deutsch');
  await userEvent.click(deOption);

  const input = screen.getByDisplayValue('Umsatz');
  fireEvent.change(input, { target: { value: 'Einnahmen' } });

  expect(mockSetControlValue).toHaveBeenCalledWith(
    'translations',
    expect.objectContaining({
      x_axis_title: expect.objectContaining({ de: 'Einnahmen' }),
    }),
  );
});

test('edits default value via onChange in default locale mode', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  const onChange = jest.fn();
  render(
    <TranslatableTextControl {...baseProps} onChange={onChange} />,
    {
      useRedux: true,
      initialState: { common: { locale: 'en' } },
    },
  );
  await screen.findByLabelText(/Locale switcher/i);
  const input = screen.getByDisplayValue('Revenue');
  fireEvent.change(input, { target: { value: 'Sales' } });
  await waitFor(() => expect(onChange).toHaveBeenCalled());
});

test('shows placeholder with default value when editing translation', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  render(
    <TranslatableTextControl
      {...baseProps}
      formData={{
        datasource: '1__table',
        viz_type: 'echarts_timeseries',
        x_axis_title: 'Revenue',
        translations: { x_axis_title: {} },
      }}
    />,
    {
      useRedux: true,
      initialState: { common: { locale: 'en' } },
    },
  );
  const switcher = await screen.findByLabelText(/Locale switcher/i);
  await userEvent.click(switcher);
  const deOption = await screen.findByText('Deutsch');
  await userEvent.click(deOption);
  expect(screen.getByPlaceholderText('Revenue')).toBeInTheDocument();
});
