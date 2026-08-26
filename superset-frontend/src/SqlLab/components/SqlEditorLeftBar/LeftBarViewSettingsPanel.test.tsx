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
import { sqlLab, resetLeftBarViews } from 'src/core';
import {
  applyLeftBarViewSettings,
  resetLeftBarViewSettings,
  useLeftBarViewSettings,
} from 'src/SqlLab/hooks/useLeftBarViewSettings';
import { TAB_EXPLORER_ID } from 'src/SqlLab/hooks/useLeftBarTabs';
import LeftBarViewSettingsPanel from './LeftBarViewSettingsPanel';

const noop = () => null;

let latestSettings: ReturnType<typeof useLeftBarViewSettings> | undefined;
const SettingsProbe = () => {
  latestSettings = useLeftBarViewSettings();
  return null;
};

beforeEach(() => {
  resetLeftBarViews();
  resetLeftBarViewSettings();
  latestSettings = undefined;
});

test('lists every registered view, plus the built-in Explorer, with checkboxes checked by default', () => {
  sqlLab.registerLeftBarView({ id: 'ext.a', name: 'Ext A' }, noop, noop);
  sqlLab.registerLeftBarView({ id: 'ext.b', name: 'Ext B' }, noop, noop);

  render(<LeftBarViewSettingsPanel />);

  expect(screen.getByRole('checkbox', { name: 'Explorer' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Ext A' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Ext B' })).toBeChecked();
});

test('unchecking a view and clicking Apply persists it as hidden', async () => {
  sqlLab.registerLeftBarView({ id: 'ext.a', name: 'Ext A' }, noop, noop);
  sqlLab.registerLeftBarView({ id: 'ext.b', name: 'Ext B' }, noop, noop);

  render(
    <>
      <LeftBarViewSettingsPanel />
      <SettingsProbe />
    </>,
  );

  await userEvent.click(screen.getByRole('checkbox', { name: 'Ext A' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(latestSettings).toEqual({
    order: [TAB_EXPLORER_ID, 'ext.a', 'ext.b'],
    hidden: ['ext.a'],
  });
});

test('Explorer can be unchecked and hidden just like any other entry', async () => {
  sqlLab.registerLeftBarView({ id: 'ext.a', name: 'Ext A' }, noop, noop);

  render(
    <>
      <LeftBarViewSettingsPanel />
      <SettingsProbe />
    </>,
  );

  await userEvent.click(screen.getByRole('checkbox', { name: 'Explorer' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(latestSettings).toEqual({
    order: [TAB_EXPLORER_ID, 'ext.a'],
    hidden: [TAB_EXPLORER_ID],
  });
});

test('Apply is disabled once every item is unchecked, and re-enables once one is checked again', async () => {
  sqlLab.registerLeftBarView({ id: 'ext.a', name: 'Ext A' }, noop, noop);

  render(<LeftBarViewSettingsPanel />);

  const applyButton = screen.getByRole('button', { name: 'Apply' });
  expect(applyButton).toBeEnabled();

  await userEvent.click(screen.getByRole('checkbox', { name: 'Explorer' }));
  expect(applyButton).toBeEnabled();

  await userEvent.click(screen.getByRole('checkbox', { name: 'Ext A' }));
  expect(applyButton).toBeDisabled();

  await userEvent.click(screen.getByRole('checkbox', { name: 'Ext A' }));
  expect(applyButton).toBeEnabled();
});

test('clicking a disabled Apply does not persist settings with nothing visible', async () => {
  sqlLab.registerLeftBarView({ id: 'ext.a', name: 'Ext A' }, noop, noop);

  render(
    <>
      <LeftBarViewSettingsPanel />
      <SettingsProbe />
    </>,
  );

  await userEvent.click(screen.getByRole('checkbox', { name: 'Explorer' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ext A' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(latestSettings).toEqual({ order: [], hidden: [] });
});

test('Cancel discards an unchecked-but-not-applied edit', async () => {
  sqlLab.registerLeftBarView({ id: 'ext.a', name: 'Ext A' }, noop, noop);

  render(<LeftBarViewSettingsPanel />);

  const checkbox = screen.getByRole('checkbox', { name: 'Ext A' });
  await userEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.getByRole('checkbox', { name: 'Ext A' })).toBeChecked();
});

test('Cancel does not persist anything', async () => {
  sqlLab.registerLeftBarView({ id: 'ext.a', name: 'Ext A' }, noop, noop);

  render(
    <>
      <LeftBarViewSettingsPanel />
      <SettingsProbe />
    </>,
  );

  await userEvent.click(screen.getByRole('checkbox', { name: 'Ext A' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(latestSettings).toEqual({ order: [], hidden: [] });
});

test('initializes from previously applied settings, showing hidden views unchecked', () => {
  sqlLab.registerLeftBarView({ id: 'ext.a', name: 'Ext A' }, noop, noop);
  sqlLab.registerLeftBarView({ id: 'ext.b', name: 'Ext B' }, noop, noop);
  applyLeftBarViewSettings({ order: ['ext.b', 'ext.a'], hidden: ['ext.a'] });

  render(<LeftBarViewSettingsPanel />);

  expect(screen.getByRole('checkbox', { name: 'Ext A' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Ext B' })).toBeChecked();
});
