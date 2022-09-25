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

import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { PageHeaderWithActions, PageHeaderWithActionsProps } from './index';
import { Menu } from '../Menu';

jest.mock('src/components/Icons/Icon', () => () => <span />);

const defaultProps: PageHeaderWithActionsProps = {
  editableTitleProps: {
    title: 'Test title',
    placeholder: 'Test placeholder',
    onSave: jest.fn(),
    canEdit: true,
    label: 'Title',
  },
  showTitlePanelItems: true,
  certificatiedBadgeProps: {},
  showFaveStar: true,
  faveStarProps: { itemId: 1, saveFaveStar: jest.fn() },
  titlePanelAdditionalItems: <button type="button">Title panel button</button>,
  rightPanelAdditionalItems: <button type="button">Save</button>,
  additionalActionsMenu: (
    <Menu>
      <Menu.Item>Test menu item</Menu.Item>
    </Menu>
  ),
  menuDropdownProps: { onVisibleChange: jest.fn(), visible: true },
};

test('Renders', async () => {
  render(<PageHeaderWithActions {...defaultProps} />);
  expect(screen.getByText('Test title')).toBeVisible();
  expect(screen.getByTestId('fave-unfave-icon')).toBeVisible();
  expect(screen.getByText('Title panel button')).toBeVisible();
  expect(screen.getByText('Save')).toBeVisible();

  userEvent.click(screen.getByLabelText('Menu actions trigger'));
  expect(defaultProps.menuDropdownProps.onVisibleChange).toHaveBeenCalled();
});
