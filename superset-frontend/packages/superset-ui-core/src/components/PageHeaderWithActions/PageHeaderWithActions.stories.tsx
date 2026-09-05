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
import MetadataBar, { MetadataType } from '../MetadataBar';
import { Menu } from '../Menu';
import { PageHeaderWithActions, PageHeaderWithActionsProps } from '.';

export default {
  title: 'Design System/Components/PageHeaderWithActions',
  component: PageHeaderWithActions,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Header used on entity pages (e.g. the dashboard page) combining an editable title with badges, a metadata bar, and page-level actions.',
      },
    },
  },
};

// Mirrors src/dashboard/components/Header's real composition: an editable
// title plus a MetadataBar (Last Modified + Editor) rendered in
// titlePanelAdditionalItems, so this story reproduces the header's real
// narrow-viewport layout behavior, not just the isolated MetadataBar.
export const DashboardHeader = (args: PageHeaderWithActionsProps) => (
  <PageHeaderWithActions {...args} />
);

DashboardHeader.args = {
  editableTitleProps: {
    title: 'Q3 Executive Revenue and Growth Overview Dashboard',
    placeholder: 'Add the name of the dashboard',
    onSave: () => {},
    canEdit: true,
    label: 'Dashboard title',
  },
  showTitlePanelItems: true,
  certificatiedBadgeProps: {},
  showFaveStar: true,
  faveStarProps: { itemId: 1, saveFaveStar: () => {}, isStarred: false },
  titlePanelAdditionalItems: (
    <MetadataBar
      tooltipPlacement="bottom"
      items={[
        {
          type: MetadataType.LastModified,
          value: '2 hours ago',
          modifiedBy: 'Jane Doe',
        },
        {
          type: MetadataType.Editor,
          createdBy: 'Jane Doe',
          editors: ['Jane Doe', 'John Smith'],
          createdOn: 'a week ago',
        },
      ]}
    />
  ),
  rightPanelAdditionalItems: <button type="button">Edit dashboard</button>,
  additionalActionsMenu: (
    <Menu
      items={[{ label: 'Edit properties', key: '1' }]}
      data-test="additional-actions-menu"
    />
  ),
  menuDropdownProps: {},
};
