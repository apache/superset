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
import { TableTab } from 'src/views/CRUD/types';
import { render, screen } from 'spec/helpers/testing-library';
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
      const { container } = render(<EmptyState {...variant} />);

      // Select the first description node
      expect(
        container.querySelector('.ant-empty-description'),
      ).toHaveTextContent('Nothing here yet');
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });
  });

  recents.forEach(recent => {
    it(`renders a ${recent.tab} ${recent.tableName} empty state`, () => {
      const { container } = render(<EmptyState {...recent} />);

      // Select the first description node
      // Check the correct text is displayed
      expect(
        container.querySelector('.ant-empty-description'),
      ).toHaveTextContent('Nothing here yet');

      // Validate the image
      expect(
        container.querySelector('.ant-empty-image')?.children,
      ).toHaveLength(1);
    });
  });
});
