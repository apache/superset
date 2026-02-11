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

import { render, screen, userEvent, waitFor } from 'spec/helpers/testing-library';
import type { Translations, LocaleInfo } from 'src/types/Localization';
import LocaleSwitcher from './LocaleSwitcher';
import { DEFAULT_LOCALE_KEY } from './utils';

const ALL_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
];

const createProps = (overrides: Partial<Parameters<typeof LocaleSwitcher>[0]> = {}) => ({
  fieldName: 'dashboard_title',
  defaultValue: 'Sales Dashboard',
  translations: {
    dashboard_title: { de: 'Verkaufs-Dashboard' },
  } as Translations,
  allLocales: ALL_LOCALES,
  defaultLocale: 'en',
  userLocale: 'en',
  activeLocale: DEFAULT_LOCALE_KEY,
  onLocaleChange: jest.fn(),
  fieldLabel: 'Dashboard Title',
  ...overrides,
});

test('renders trigger button with correct aria-label', () => {
  render(<LocaleSwitcher {...createProps()} />, { useTheme: true });

  expect(
    screen.getByRole('button', { name: /Locale switcher for Dashboard Title/i }),
  ).toBeInTheDocument();
});

test('aria-label includes translation count', () => {
  render(<LocaleSwitcher {...createProps()} />, { useTheme: true });

  expect(
    screen.getByRole('button', { name: /1 translations/i }),
  ).toBeInTheDocument();
});

test('opens dropdown with DEFAULT and locale menuitems on click', async () => {
  render(<LocaleSwitcher {...createProps()} />, { useTheme: true });

  await userEvent.click(
    screen.getByRole('button', { name: /Locale switcher for/i }),
  );

  await waitFor(() => {
    expect(screen.getByRole('menuitem', { name: /DEFAULT/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /English/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /German/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /French/ })).toBeInTheDocument();
  });
});

test('calls onLocaleChange when locale selected from dropdown', async () => {
  const onLocaleChange = jest.fn();
  render(
    <LocaleSwitcher {...createProps({ onLocaleChange })} />,
    { useTheme: true },
  );

  await userEvent.click(
    screen.getByRole('button', { name: /Locale switcher for/i }),
  );

  await waitFor(() => {
    expect(screen.getByRole('menuitem', { name: /German/ })).toBeInTheDocument();
  });

  await userEvent.click(screen.getByRole('menuitem', { name: /German/ }));

  expect(onLocaleChange).toHaveBeenCalledWith('de');
});

test('calls onLocaleChange with DEFAULT_LOCALE_KEY when DEFAULT selected', async () => {
  const onLocaleChange = jest.fn();
  render(
    <LocaleSwitcher {...createProps({ onLocaleChange, activeLocale: 'de' })} />,
    { useTheme: true },
  );

  await userEvent.click(
    screen.getByRole('button', { name: /Locale switcher for/i }),
  );

  await waitFor(() => {
    expect(screen.getByText('DEFAULT')).toBeInTheDocument();
  });

  await userEvent.click(screen.getByText('DEFAULT'));

  expect(onLocaleChange).toHaveBeenCalledWith(DEFAULT_LOCALE_KEY);
});

test('renders with zero translations when field has none', () => {
  render(
    <LocaleSwitcher {...createProps({ translations: {} })} />,
    { useTheme: true },
  );

  expect(
    screen.getByRole('button', { name: /0 translations/i }),
  ).toBeInTheDocument();
});
