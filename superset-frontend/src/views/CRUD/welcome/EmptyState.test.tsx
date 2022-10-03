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
import { styledMount as mount } from 'spec/helpers/theming';
import EmptyState from 'src/views/CRUD/welcome/EmptyState';
import { WelcomeTable } from './types';

describe('EmptyState', () => {
  const variants = [
    {
      tab: 'Favorite',
      tableName: WelcomeTable.Dashboards,
    },
    {
      tab: 'Mine',
      tableName: WelcomeTable.Dashboards,
    },
    {
      tab: 'Favorite',
      tableName: WelcomeTable.Charts,
    },
    {
      tab: 'Mine',
      tableName: WelcomeTable.Charts,
    },
    {
      tab: 'Favorite',
      tableName: WelcomeTable.SavedQueries,
    },
    {
      tab: 'Mine',
      tableName: WelcomeTable.SavedQueries,
    },
  ];
  const recents = [
    {
      tab: 'Viewed',
      tableName: WelcomeTable.Recents,
    },
    {
      tab: 'Edited',
      tableName: WelcomeTable.Recents,
    },
    {
      tab: 'Created',
      tableName: WelcomeTable.Recents,
    },
  ];
  variants.forEach(variant => {
    it(`it renders an ${variant.tab} ${variant.tableName} empty state`, () => {
      const wrapper = mount(<EmptyState {...variant} />);
      expect(wrapper).toExist();
      const textContainer = wrapper.find('.ant-empty-description');
      expect(textContainer.text()).toEqual(
        variant.tab === 'Favorite'
          ? "You don't have any favorites yet!"
          : `No ${
              variant.tableName === 'SAVED_QUERIES'
                ? 'saved queries'
                : variant.tableName.toLowerCase()
            } yet`,
      );
      expect(wrapper.find('button')).toHaveLength(1);
    });
  });
  recents.forEach(recent => {
    it(`it renders an ${recent.tab} ${recent.tableName} empty state`, () => {
      const wrapper = mount(<EmptyState {...recent} />);
      expect(wrapper).toExist();
      const textContainer = wrapper.find('.ant-empty-description');
      expect(wrapper.find('.ant-empty-image').children()).toHaveLength(1);
      expect(textContainer.text()).toContain(
        `Recently ${recent.tab.toLowerCase()} charts, dashboards, and saved queries will appear here`,
      );
    });
  });
});
