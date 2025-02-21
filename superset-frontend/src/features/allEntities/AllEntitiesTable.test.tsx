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

import { render, screen } from 'spec/helpers/testing-library';
import * as useQueryParamsModule from 'use-query-params';
import AllEntitiesTable from './AllEntitiesTable';

describe('AllEntitiesTable', () => {
  const mockSetShowTagModal = jest.fn();

  const mockObjects = {
    dashboard: [],
    chart: [],
    query: [],
  };

  const mockObjectsWithTags = {
    dashboard: [
      {
        id: 1,
        type: 'dashboard',
        name: 'Sales Dashboard',
        url: '/dashboard/1',
        changed_on: '2023-11-20T12:34:56Z',
        created_by: 1,
        creator: 'John Doe',
        owners: [{ id: 1, first_name: 'John', last_name: 'Doe' }],
        tags: [
          { id: 101, name: 'Sales', type: 'TagType.custom' },
          { id: 42, name: 'Current Tag', type: 'TagType.custom' },
        ],
      },
    ],
    chart: [
      {
        id: 2,
        type: 'chart',
        name: 'Monthly Revenue',
        url: '/chart/2',
        changed_on: '2023-11-19T12:00:00Z',
        created_by: 2,
        creator: 'Jane Smith',
        owners: [{ id: 2, first_name: 'Jane', last_name: 'Smith' }],
        tags: [
          { id: 102, name: 'Revenue', type: 'TagType.custom' },
          { id: 42, name: 'Current Tag', type: 'TagType.custom' },
        ],
      },
    ],
    query: [
      {
        id: 3,
        type: 'query',
        name: 'User Engagement',
        url: '/query/3',
        changed_on: '2023-11-18T09:30:00Z',
        created_by: 3,
        creator: 'Alice Brown',
        owners: [{ id: 3, first_name: 'Alice', last_name: 'Brown' }],
        tags: [
          { id: 103, name: 'Engagement', type: 'TagType.custom' },
          { id: 42, name: 'Current Tag', type: 'TagType.custom' },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest
      .spyOn(useQueryParamsModule, 'useQueryParam')
      .mockReturnValue([42, jest.fn()]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders when empty', () => {
    render(
      <AllEntitiesTable
        search=""
        setShowTagModal={mockSetShowTagModal}
        objects={mockObjects}
      />,
    );

    expect(
      screen.getByText('No entities have this tag currently assigned'),
    ).toBeInTheDocument();

    expect(screen.getByText('Add tag to entities')).toBeInTheDocument();
  });

  it('renders the correct tags for each object type, excluding the current tag', () => {
    render(
      <AllEntitiesTable
        search=""
        setShowTagModal={mockSetShowTagModal}
        objects={mockObjectsWithTags}
      />,
    );

    expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();

    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();

    expect(screen.getByText('User Engagement')).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();

    expect(screen.queryByText('Current Tag')).not.toBeInTheDocument();
  });
});
