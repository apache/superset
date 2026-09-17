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
import { styledMount as mount } from 'spec/helpers/theming';
import { TableTab } from 'src/views/CRUD/types';
import EmptyState, { EmptyStateProps } from './EmptyState';
import { WelcomeTable } from './types';

describe('EmptyState', () => {
  const variants: EmptyStateProps[] = [
    {
      tab: TableTab.Favorite,
      tableName: WelcomeTable.Dashboards,
    },
    {
      tab: TableTab.Mine,
      tableName: WelcomeTable.Dashboards,
    },
    {
      tab: TableTab.Favorite,
      tableName: WelcomeTable.Charts,
    },
    {
      tab: TableTab.Mine,
      tableName: WelcomeTable.Charts,
    },
    {
      tab: TableTab.Favorite,
      tableName: WelcomeTable.SavedQueries,
    },
    {
      tab: TableTab.Mine,
      tableName: WelcomeTable.SavedQueries,
    },
  ];
  const recents: EmptyStateProps[] = [
    {
      tab: TableTab.Viewed,
      tableName: WelcomeTable.Recents,
    },
    {
      tab: TableTab.Edited,
      tableName: WelcomeTable.Recents,
    },
    {
      tab: TableTab.Created,
      tableName: WelcomeTable.Recents,
    },
  ];

  variants.forEach(variant => {
    it(`renders an ${variant.tab} ${variant.tableName} empty state`, () => {
      const wrapper = mount(<EmptyState {...variant} />);
      expect(wrapper).toExist();

      // Select the first description node
      const textContainer = wrapper.find('.ant-empty-description').at(0);
      expect(textContainer.text()).toEqual('Nothing here yet');
      expect(wrapper.find('button')).toHaveLength(1);
    });
  });

  recents.forEach(recent => {
    it(`renders a ${recent.tab} ${recent.tableName} empty state`, () => {
      const wrapper = mount(<EmptyState {...recent} />);
      expect(wrapper).toExist();

      // Select the first description node
      const textContainer = wrapper.find('.ant-empty-description').at(0);

      // Validate the image
      expect(wrapper.find('.ant-empty-image').children()).toHaveLength(1);

      // Check the correct text is displayed
      expect(textContainer.text()).toContain(`Nothing here yet`);
    });
  });
});
