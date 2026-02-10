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
  screen,
  render,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled } from '@superset-ui/core';
import { SupersetClient } from '@superset-ui/core/connection';

import AdhocMetricEditPopoverTitle, {
  AdhocMetricEditPopoverTitleProps,
} from 'src/explore/components/controls/MetricControl/AdhocMetricEditPopoverTitle';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(() => false),
}));

jest.mock('@superset-ui/core/connection', () => ({
  SupersetClient: { get: jest.fn() },
}));

const MOCK_LOCALES_RESPONSE = {
  json: {
    result: {
      locales: [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'de', name: 'German', flag: '🇩🇪' },
      ],
      default_locale: 'en',
    },
  },
};

const titleProps = {
  label: 'COUNT(*)',
  hasCustomLabel: false,
};

beforeEach(() => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(false);
  (SupersetClient.get as jest.Mock).mockResolvedValue(MOCK_LOCALES_RESPONSE);
});

const RENDER_OPTIONS = {
  useRedux: true,
  initialState: { common: { locale: 'en' } },
};

const setup = (props: Partial<AdhocMetricEditPopoverTitleProps> = {}) => {
  const onChange = jest.fn();

  const { container } = render(
    <AdhocMetricEditPopoverTitle
      title={titleProps}
      onChange={onChange}
      {...props}
    />,
    RENDER_OPTIONS,
  );

  return { container, onChange };
};

test('should render', async () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();

  expect(screen.queryByTestId('AdhocMetricTitle')).not.toBeInTheDocument();
  expect(screen.getByText(titleProps.label)).toBeVisible();
});

test('should render tooltip on hover', async () => {
  const { container } = setup();

  expect(screen.queryByText('Click to edit label')).not.toBeInTheDocument();
  fireEvent.mouseOver(screen.getByTestId('AdhocMetricEditTitle#trigger'));

  expect(await screen.findByText('Click to edit label')).toBeInTheDocument();
  expect(
    container.parentElement?.getElementsByClassName('ant-tooltip-hidden')
      .length,
  ).toBe(0);

  fireEvent.mouseOut(screen.getByTestId('AdhocMetricEditTitle#trigger'));
  await waitFor(() => {
    expect(
      container.parentElement?.getElementsByClassName('ant-tooltip-hidden')
        .length,
    ).toBe(1);
  });
});

test('render non-interactive span with title when edit is disabled', async () => {
  const { container } = setup({ isEditDisabled: true });
  expect(container).toBeInTheDocument();

  expect(screen.queryByTestId('AdhocMetricTitle')).toBeInTheDocument();
  expect(screen.getByText(titleProps.label)).toBeVisible();
  expect(
    screen.queryByTestId('AdhocMetricEditTitle#trigger'),
  ).not.toBeInTheDocument();
});

test('render default label if no title is provided', async () => {
  const { container } = setup({ title: undefined });
  expect(container).toBeInTheDocument();

  expect(screen.queryByTestId('AdhocMetricTitle')).not.toBeInTheDocument();
  expect(screen.getByText('My metric')).toBeVisible();
});

test('start and end the title edit mode', async () => {
  const { container, onChange } = setup();
  expect(container).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'edit' })).toBeInTheDocument();
  expect(screen.getByText(titleProps.label)).toBeVisible();
  expect(
    screen.queryByTestId('AdhocMetricEditTitle#input'),
  ).not.toBeInTheDocument();

  fireEvent.click(
    container.getElementsByClassName('AdhocMetricEditPopoverTitle')[0],
  );

  expect(await screen.findByTestId('AdhocMetricEditTitle#input')).toBeVisible();
  userEvent.type(screen.getByTestId('AdhocMetricEditTitle#input'), 'Test');

  expect(onChange).toHaveBeenCalledTimes(4);
  fireEvent.keyPress(screen.getByTestId('AdhocMetricEditTitle#input'), {
    key: 'Enter',
    charCode: 13,
  });

  expect(
    screen.queryByTestId('AdhocMetricEditTitle#input'),
  ).not.toBeInTheDocument();

  fireEvent.click(
    container.getElementsByClassName('AdhocMetricEditPopoverTitle')[0],
  );

  expect(await screen.findByTestId('AdhocMetricEditTitle#input')).toBeVisible();
  userEvent.type(
    screen.getByTestId('AdhocMetricEditTitle#input'),
    'Second test',
  );
  expect(onChange).toHaveBeenCalled();

  fireEvent.blur(screen.getByTestId('AdhocMetricEditTitle#input'));
  expect(
    screen.queryByTestId('AdhocMetricEditTitle#input'),
  ).not.toBeInTheDocument();
});

// --- Locale support ---

test('feature flag OFF: no locale indicator', () => {
  setup({
    title: { label: 'Revenue', hasCustomLabel: true },
    translations: {},
    onTranslationsChange: jest.fn(),
  });

  expect(screen.queryByLabelText(/Locale switcher/i)).not.toBeInTheDocument();
});

test('feature flag ON, view mode: locale indicator visible for custom label', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);

  setup({
    title: { label: 'Revenue', hasCustomLabel: true },
    translations: { label: { de: 'Umsatz' } },
    onTranslationsChange: jest.fn(),
  });

  expect(
    await screen.findByLabelText(/Locale switcher for Metric Label/i),
  ).toBeInTheDocument();
});

test('feature flag ON, no custom label: no locale indicator', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);

  setup({
    title: { label: 'COUNT(*)', hasCustomLabel: false },
    translations: {},
    onTranslationsChange: jest.fn(),
  });

  // Wait for any async effects to settle
  await waitFor(() => {
    expect(screen.queryByLabelText(/Locale switcher/i)).not.toBeInTheDocument();
  });
});

test('feature flag ON, edit mode: locale dropdown as input suffix', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);

  const { container } = setup({
    title: { label: 'Revenue', hasCustomLabel: true },
    translations: {},
    onTranslationsChange: jest.fn(),
  });

  // Wait for locales to load
  await screen.findByLabelText(/Locale switcher for Metric Label/i);

  // Enter edit mode
  fireEvent.click(
    container.getElementsByClassName('AdhocMetricEditPopoverTitle')[0],
  );

  await screen.findByTestId('AdhocMetricEditTitle#input');

  // In edit mode, LocaleSwitcher is an interactive dropdown (role="button")
  expect(
    screen.getByRole('button', { name: /Locale switcher/i }),
  ).toBeInTheDocument();
});

test('feature flag ON, select translation locale: input shows translation value', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);

  const { container } = setup({
    title: { label: 'Revenue', hasCustomLabel: true },
    translations: { label: { de: 'Umsatz' } },
    onTranslationsChange: jest.fn(),
  });

  await screen.findByLabelText(/Locale switcher for Metric Label/i);

  // Enter edit mode
  fireEvent.click(
    container.getElementsByClassName('AdhocMetricEditPopoverTitle')[0],
  );
  await screen.findByTestId('AdhocMetricEditTitle#input');

  // Open locale dropdown
  await userEvent.click(
    screen.getByRole('button', { name: /Locale switcher/i }),
  );

  // Select German
  await waitFor(() => {
    expect(screen.getByRole('menuitem', { name: /German/i })).toBeInTheDocument();
  });
  await userEvent.click(screen.getByRole('menuitem', { name: /German/i }));

  // Input now shows translation value
  await waitFor(() => {
    const input = screen.getByTestId('AdhocMetricEditTitle#input');
    expect(input).toHaveValue('Umsatz');
  });
});

test('feature flag ON, typing in translation locale calls onTranslationsChange', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  const onTranslationsChange = jest.fn();

  const { container } = setup({
    title: { label: 'Revenue', hasCustomLabel: true },
    translations: {},
    onTranslationsChange,
  });

  await screen.findByLabelText(/Locale switcher for Metric Label/i);

  // Enter edit mode
  fireEvent.click(
    container.getElementsByClassName('AdhocMetricEditPopoverTitle')[0],
  );
  await screen.findByTestId('AdhocMetricEditTitle#input');

  // Switch to German locale
  await userEvent.click(
    screen.getByRole('button', { name: /Locale switcher/i }),
  );
  await waitFor(() => {
    expect(screen.getByRole('menuitem', { name: /German/i })).toBeInTheDocument();
  });
  await userEvent.click(screen.getByRole('menuitem', { name: /German/i }));

  // Type translation and blur to flush
  const input = screen.getByTestId('AdhocMetricEditTitle#input');
  await userEvent.type(input, 'Umsatz');
  fireEvent.blur(input);

  expect(onTranslationsChange).toHaveBeenCalledWith(
    expect.objectContaining({
      label: expect.objectContaining({ de: 'Umsatz' }),
    }),
  );
});
