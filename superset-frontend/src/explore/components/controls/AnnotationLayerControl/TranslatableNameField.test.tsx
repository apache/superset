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
} from 'spec/helpers/testing-library';
import { isFeatureEnabled } from '@superset-ui/core';
import { SupersetClient } from '@superset-ui/core/connection';
import TranslatableNameField from './TranslatableNameField';

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

const baseProps = {
  value: 'Revenue Target',
  onChange: jest.fn(),
  translations: {
    name: { de: 'Umsatzziel', fr: 'Objectif de revenus' },
  },
  onTranslationsChange: jest.fn(),
  label: 'Name',
  validationErrors: [] as string[],
};

beforeEach(() => {
  jest.clearAllMocks();
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockLocalesResponse);
});

test('renders plain TextControl when feature flag is off', () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(false);
  render(<TranslatableNameField {...baseProps} />);
  expect(screen.getByDisplayValue('Revenue Target')).toBeInTheDocument();
  expect(screen.queryByLabelText(/Locale switcher/i)).not.toBeInTheDocument();
});

test('renders LocaleSwitcher when feature flag is on', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  render(<TranslatableNameField {...baseProps} />, {
    useRedux: true,
    initialState: { common: { locale: 'en' } },
  });
  expect(
    await screen.findByLabelText(/Locale switcher/i),
  ).toBeInTheDocument();
});

test('shows translation value when locale is switched to de', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  render(<TranslatableNameField {...baseProps} />, {
    useRedux: true,
    initialState: { common: { locale: 'en' } },
  });
  const switcher = await screen.findByLabelText(/Locale switcher/i);
  await userEvent.click(switcher);
  await userEvent.click(await screen.findByText('Deutsch'));
  expect(screen.getByDisplayValue('Umsatzziel')).toBeInTheDocument();
});

test('calls onTranslationsChange when editing in locale mode', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  const onTranslationsChange = jest.fn();
  render(
    <TranslatableNameField
      {...baseProps}
      onTranslationsChange={onTranslationsChange}
    />,
    {
      useRedux: true,
      initialState: { common: { locale: 'en' } },
    },
  );
  const switcher = await screen.findByLabelText(/Locale switcher/i);
  await userEvent.click(switcher);
  await userEvent.click(await screen.findByText('Deutsch'));

  const input = screen.getByDisplayValue('Umsatzziel');
  fireEvent.change(input, { target: { value: 'Einnahmen' } });

  expect(onTranslationsChange).toHaveBeenCalledWith({
    name: { de: 'Einnahmen', fr: 'Objectif de revenus' },
  });
});

test('calls onChange when editing in default locale mode', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  const onChange = jest.fn();
  render(
    <TranslatableNameField {...baseProps} onChange={onChange} />,
    {
      useRedux: true,
      initialState: { common: { locale: 'en' } },
    },
  );
  await screen.findByLabelText(/Locale switcher/i);
  const input = screen.getByDisplayValue('Revenue Target');
  fireEvent.change(input, { target: { value: 'Sales Target' } });
  expect(onChange).toHaveBeenCalledWith('Sales Target');
});

test('shows placeholder with default value when editing empty translation', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  render(
    <TranslatableNameField {...baseProps} translations={{ name: {} }} />,
    {
      useRedux: true,
      initialState: { common: { locale: 'en' } },
    },
  );
  const switcher = await screen.findByLabelText(/Locale switcher/i);
  await userEvent.click(switcher);
  await userEvent.click(await screen.findByText('Deutsch'));
  expect(screen.getByPlaceholderText('Revenue Target')).toBeInTheDocument();
});

test('renders validation error indicator when feature flag is off', () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(false);
  render(
    <TranslatableNameField
      {...baseProps}
      value=""
      validationErrors={['Mandatory']}
    />,
  );
  expect(screen.getByTestId('error-tooltip')).toBeInTheDocument();
});
