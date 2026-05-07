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
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { ThemeMode } from '@superset-ui/core';
import { Menu } from '@superset-ui/core/components';
import { ThemeSubMenuProps, useThemeMenuItems } from './useThemeMenuItems';

// Mock the translation function
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  t: (key: string) => key,
}));

const TestComponent = (props: ThemeSubMenuProps) => {
  const menuItem = useThemeMenuItems(props);
  return <Menu items={[menuItem]} />;
};

describe('useThemeMenuItems', () => {
  const defaultProps = {
    allowOSPreference: true,
    setThemeMode: jest.fn(),
    themeMode: ThemeMode.DEFAULT,
    hasLocalOverride: false,
    onClearLocalSettings: jest.fn(),
  };

  const renderThemeMenu = (props = defaultProps) =>
    render(<TestComponent {...props} />);

  const findMenuWithText = async (text: string) => {
    await waitFor(() => {
      const found = screen
        .getAllByRole('menu')
        .some(m => within(m).queryByText(text));

      if (!found) throw new Error(`Menu with text "${text}" not yet rendered`);
    });

    return screen.getAllByRole('menu').find(m => within(m).queryByText(text))!;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Light and Dark theme options by default', async () => {
    renderThemeMenu();

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Light');

    expect(within(menu!).getByText('Light')).toBeInTheDocument();
    expect(within(menu!).getByText('Dark')).toBeInTheDocument();
  });

  it('does not render Match system option when allowOSPreference is false', async () => {
    renderThemeMenu({ ...defaultProps, allowOSPreference: false });
    await userEvent.hover(await screen.findByRole('menuitem'));

    await waitFor(() => {
      expect(screen.queryByText('Match system')).not.toBeInTheDocument();
    });
  });

  it('renders with allowOSPreference as true by default', async () => {
    renderThemeMenu();

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Match system');

    expect(within(menu).getByText('Match system')).toBeInTheDocument();
  });

  it('renders clear option when both hasLocalOverride and onClearLocalSettings are provided', async () => {
    const mockClear = jest.fn();
    renderThemeMenu({
      ...defaultProps,
      hasLocalOverride: true,
      onClearLocalSettings: mockClear,
    });

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Clear local theme');

    expect(within(menu).getByText('Clear local theme')).toBeInTheDocument();
  });

  it('does not render clear option when hasLocalOverride is false', async () => {
    const mockClear = jest.fn();
    renderThemeMenu({
      ...defaultProps,
      hasLocalOverride: false,
      onClearLocalSettings: mockClear,
    });

    await userEvent.hover(await screen.findByRole('menuitem'));

    await waitFor(() => {
      expect(screen.queryByText('Clear local theme')).not.toBeInTheDocument();
    });
  });

  it('calls setThemeMode with DEFAULT when Light is clicked', async () => {
    const mockSet = jest.fn();
    renderThemeMenu({ ...defaultProps, setThemeMode: mockSet });

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Light');
    await userEvent.click(within(menu).getByText('Light'));

    expect(mockSet).toHaveBeenCalledWith(ThemeMode.DEFAULT);
  });

  it('calls setThemeMode with DARK when Dark is clicked', async () => {
    const mockSet = jest.fn();
    renderThemeMenu({ ...defaultProps, setThemeMode: mockSet });

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Dark');
    await userEvent.click(within(menu).getByText('Dark'));

    expect(mockSet).toHaveBeenCalledWith(ThemeMode.DARK);
  });

  it('calls setThemeMode with SYSTEM when Match system is clicked', async () => {
    const mockSet = jest.fn();
    renderThemeMenu({ ...defaultProps, setThemeMode: mockSet });

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Match system');
    await userEvent.click(within(menu).getByText('Match system'));

    expect(mockSet).toHaveBeenCalledWith(ThemeMode.SYSTEM);
  });

  it('calls onClearLocalSettings when Clear local theme is clicked', async () => {
    const mockClear = jest.fn();
    renderThemeMenu({
      ...defaultProps,
      hasLocalOverride: true,
      onClearLocalSettings: mockClear,
    });

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Clear local theme');
    await userEvent.click(within(menu).getByText('Clear local theme'));

    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('displays sun icon for DEFAULT theme', () => {
    renderThemeMenu({ ...defaultProps, themeMode: ThemeMode.DEFAULT });
    expect(screen.getByTestId('sun')).toBeInTheDocument();
  });

  it('displays moon icon for DARK theme', () => {
    renderThemeMenu({ ...defaultProps, themeMode: ThemeMode.DARK });
    expect(screen.getByTestId('moon')).toBeInTheDocument();
  });

  it('displays format-painter icon for SYSTEM theme', () => {
    renderThemeMenu({ ...defaultProps, themeMode: ThemeMode.SYSTEM });
    expect(screen.getByTestId('format-painter')).toBeInTheDocument();
  });

  it('displays override icon when hasLocalOverride is true', () => {
    renderThemeMenu({ ...defaultProps, hasLocalOverride: true });
    expect(screen.getByTestId('thunderbolt')).toBeInTheDocument();
  });

  it('renders Theme group header', async () => {
    renderThemeMenu();

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Theme');

    expect(within(menu).getByText('Theme')).toBeInTheDocument();
  });

  it('renders sun icon for Light theme option', async () => {
    renderThemeMenu();

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Light');
    const lightOption = within(menu).getByText('Light').closest('li');

    expect(within(lightOption!).getByTestId('sun')).toBeInTheDocument();
  });

  it('renders moon icon for Dark theme option', async () => {
    renderThemeMenu();

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Dark');
    const darkOption = within(menu).getByText('Dark').closest('li');

    expect(within(darkOption!).getByTestId('moon')).toBeInTheDocument();
  });

  it('renders format-painter icon for Match system option', async () => {
    renderThemeMenu({ ...defaultProps, allowOSPreference: true });

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Match system');
    const matchOption = within(menu).getByText('Match system').closest('li');

    expect(
      within(matchOption!).getByTestId('format-painter'),
    ).toBeInTheDocument();
  });

  it('renders clear icon for Clear local theme option', async () => {
    renderThemeMenu({
      ...defaultProps,
      hasLocalOverride: true,
      onClearLocalSettings: jest.fn(),
    });

    await userEvent.hover(await screen.findByRole('menuitem'));
    const menu = await findMenuWithText('Clear local theme');
    const clearOption = within(menu)
      .getByText('Clear local theme')
      .closest('li');

    expect(within(clearOption!).getByTestId('clear')).toBeInTheDocument();
  });

  it('renders divider before clear option when clear option is present', async () => {
    renderThemeMenu({
      ...defaultProps,
      hasLocalOverride: true,
      onClearLocalSettings: jest.fn(),
    });

    await userEvent.hover(await screen.findByRole('menuitem'));

    const menu = await findMenuWithText('Clear local theme');
    const divider = within(menu).queryByRole('separator');

    expect(divider).toBeInTheDocument();
  });

  it('does not render divider when clear option is not present', async () => {
    renderThemeMenu({ ...defaultProps });

    await userEvent.hover(await screen.findByRole('menuitem'));
    const divider = document.querySelector('.ant-menu-item-divider');

    expect(divider).toBeNull();
  });
});
