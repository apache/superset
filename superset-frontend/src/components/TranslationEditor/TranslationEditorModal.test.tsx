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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import TranslationEditorModal from './TranslationEditorModal';
import type { Translations, LocaleInfo } from 'src/types/Localization';

const AVAILABLE_LOCALES: LocaleInfo[] = [
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'ru', name: 'Russian' },
];

const FIELDS = [
  {
    name: 'dashboard_title',
    label: 'Dashboard Title',
    value: 'Sales Dashboard',
  },
  { name: 'description', label: 'Description', value: 'Monthly report' },
];

const EXISTING_TRANSLATIONS: Translations = {
  dashboard_title: { de: 'Verkaufs-Dashboard', fr: 'Tableau de bord' },
  description: { de: 'Monatlicher Bericht' },
};

const defaultProps = {
  show: true,
  fields: FIELDS,
  translations: EXISTING_TRANSLATIONS,
  availableLocales: AVAILABLE_LOCALES,
  onSave: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders field sections with labels and original values', () => {
  render(<TranslationEditorModal {...defaultProps} />);
  expect(screen.getByText('Dashboard Title')).toBeInTheDocument();
  expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
  expect(screen.getByText('Description')).toBeInTheDocument();
  expect(screen.getByText('Monthly report')).toBeInTheDocument();
});

test('does not render when show is false', () => {
  render(<TranslationEditorModal {...defaultProps} show={false} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('displays existing translations', () => {
  render(<TranslationEditorModal {...defaultProps} />);
  expect(screen.getByDisplayValue('Verkaufs-Dashboard')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Tableau de bord')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Monatlicher Bericht')).toBeInTheDocument();
});

test('displays locale labels for existing translations', () => {
  render(<TranslationEditorModal {...defaultProps} />);
  // "de" appears in both dashboard_title and description sections
  const germanLabels = screen.getAllByText('German (de)');
  expect(germanLabels).toHaveLength(2);
  expect(screen.getByText('French (fr)')).toBeInTheDocument();
});

test('removes translation when delete button is clicked', async () => {
  render(<TranslationEditorModal {...defaultProps} />);
  expect(screen.getByDisplayValue('Tableau de bord')).toBeInTheDocument();

  // French only appears in dashboard_title, so there is exactly one Remove French button
  await userEvent.click(
    screen.getByRole('button', { name: /remove french/i }),
  );

  expect(screen.queryByDisplayValue('Tableau de bord')).not.toBeInTheDocument();
});

test('edits translation value on input change', () => {
  render(<TranslationEditorModal {...defaultProps} />);
  const input = screen.getByDisplayValue('Verkaufs-Dashboard');
  fireEvent.change(input, { target: { value: 'Neuer Name' } });
  expect(screen.getByDisplayValue('Neuer Name')).toBeInTheDocument();
});

test('save calls onSave with updated translations', async () => {
  const onSave = jest.fn();
  render(<TranslationEditorModal {...defaultProps} onSave={onSave} />);

  fireEvent.change(screen.getByDisplayValue('Verkaufs-Dashboard'), {
    target: { value: 'Geändert' },
  });

  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0] as Translations;
  expect(saved.dashboard_title.de).toBe('Geändert');
});

test('save strips empty translation values', async () => {
  const onSave = jest.fn();
  render(<TranslationEditorModal {...defaultProps} onSave={onSave} />);

  fireEvent.change(screen.getByDisplayValue('Tableau de bord'), {
    target: { value: '' },
  });

  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  const saved = onSave.mock.calls[0][0] as Translations;
  expect(saved.dashboard_title.fr).toBeUndefined();
});

test('cancel calls onClose without saving', async () => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <TranslationEditorModal
      {...defaultProps}
      onSave={onSave}
      onClose={onClose}
    />,
  );

  fireEvent.change(screen.getByDisplayValue('Verkaufs-Dashboard'), {
    target: { value: 'Geändert' },
  });

  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
});
