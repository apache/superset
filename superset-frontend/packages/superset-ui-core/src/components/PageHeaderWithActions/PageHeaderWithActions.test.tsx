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

import { render, screen, userEvent } from '@superset-ui/core/spec';
import { supersetTheme } from '@apache-superset/core/theme';
import {
  buttonsStyles,
  PageHeaderWithActions,
  PageHeaderWithActionsProps,
} from './index';
import { Menu } from '../Menu';

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
    <Menu
      items={[{ label: 'Test menu item', key: '1' }]}
      data-test="additional-actions-menu"
    />
  ),
  menuDropdownProps: { onOpenChange: jest.fn(), open: true },
};

test('Renders', async () => {
  render(<PageHeaderWithActions {...defaultProps} />);
  expect(screen.getByText('Test title')).toBeVisible();
  expect(screen.getByTestId('fave-unfave-icon')).toBeVisible();
  expect(screen.getByText('Title panel button')).toBeVisible();
  expect(screen.getByText('Save')).toBeVisible();

  await userEvent.click(screen.getByLabelText('Menu actions trigger'));
  expect(defaultProps.menuDropdownProps.onOpenChange).toHaveBeenCalled();
});

test('clips the title panel buttons/metadata cluster instead of letting it overflow into the actions menu', () => {
  // jsdom doesn't compute real flexbox layout, so it can't verify the
  // overlap itself is fixed; this guards the underlying CSS from
  // regressing instead. Without `overflow: hidden`, this wrapper's
  // automatic flex minimum size is based on its content rather than 0, so
  // it refuses to shrink -- forcing the title to absorb all the space
  // pressure until the cluster's content renders outside its box and
  // overlaps the actions menu once the title has fully collapsed.
  const { styles } = buttonsStyles(supersetTheme);
  expect(styles).toMatch(/overflow:\s*hidden/);
});
