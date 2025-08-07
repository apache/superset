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
import fetchMock from 'fetch-mock';
import { act, render, screen, within } from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import userEvent from '@testing-library/user-event';
import RowLevelSecurityList from '.';

const ruleListEndpoint = 'glob:*/api/v1/rowlevelsecurity/?*';
const ruleInfoEndpoint = 'glob:*/api/v1/rowlevelsecurity/_info*';

const mockRules = [
  {
    changed_on_delta_humanized: '1 days ago',
    clause: '1=1',
    description: 'some description',
    filter_type: 'Regular',
    group_key: 'group-1',
    id: 1,
    name: 'rule 1',
    roles: [
      {
        id: 3,
        name: 'Alpha',
      },
      {
        id: 5,
        name: 'Gamma',
      },
    ],
    tables: [
      {
        id: 6,
        table_name: 'flights',
      },
      {
        id: 13,
        table_name: 'messages',
      },
    ],
  },
  {
    changed_on_delta_humanized: '2 days ago',
    clause: '2=2',
    description: 'some description 2',
    filter_type: 'Base',
    group_key: 'group-1',
    id: 2,
    name: 'rule 2',
    roles: [
      {
        id: 3,
        name: 'Alpha',
      },
      {
        id: 5,
        name: 'Gamma',
      },
    ],
    tables: [
      {
        id: 6,
        table_name: 'flights',
      },
      {
        id: 13,
        table_name: 'messages',
      },
    ],
  },
];
fetchMock.get(ruleListEndpoint, { result: mockRules, count: 2 });
fetchMock.get(ruleInfoEndpoint, { permissions: ['can_read', 'can_write'] });
global.URL.createObjectURL = jest.fn();

const mockUser = {
  userId: 1,
};

describe('RuleList RTL', () => {
  async function renderAndWait() {
    const mounted = act(async () => {
      const mockedProps = {};
      render(
        <MemoryRouter>
          <QueryParamProvider>
            <RowLevelSecurityList {...mockedProps} user={mockUser} />
          </QueryParamProvider>
        </MemoryRouter>,
        { useRedux: true },
      );
    });
    return mounted;
  }

  it('renders', async () => {
    await renderAndWait();
    expect(screen.getByText('Row Level Security')).toBeVisible();
  });

  it('renders a ListView', async () => {
    await renderAndWait();
    expect(screen.getByTestId('rls-list-view')).toBeInTheDocument();
  });

  it('fetched data', async () => {
    fetchMock.resetHistory();
    await renderAndWait();
    const apiCalls = fetchMock.calls(/rowlevelsecurity\/\?q/);
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/rowlevelsecurity/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
    fetchMock.resetHistory();
  });

  it('renders add rule button on empty state', async () => {
    fetchMock.get(
      ruleListEndpoint,
      { result: [], count: 0 },
      { overwriteRoutes: true },
    );
    await renderAndWait();

    const emptyAddRuleButton = await screen.findByTestId('add-rule-empty');
    expect(emptyAddRuleButton).toBeInTheDocument();
    fetchMock.get(
      ruleListEndpoint,
      { result: mockRules, count: 2 },
      { overwriteRoutes: true },
    );
  });

  it('renders a "Rule" button to add a rule in bulk action', async () => {
    await renderAndWait();

    const addRuleButton = await screen.findByTestId('add-rule');
    const emptyAddRuleButton = screen.queryByTestId('add-rule-empty');
    expect(addRuleButton).toBeInTheDocument();
    expect(emptyAddRuleButton).not.toBeInTheDocument();
  });

  it('renders filter options', async () => {
    await renderAndWait();

    const searchFilters = screen.queryAllByTestId('filters-search');
    expect(searchFilters).toHaveLength(2);

    const typeFilter = screen.queryAllByTestId('filters-select');
    expect(typeFilter).toHaveLength(3); // Update to expect 3 select filters
  });

  it('renders correct list columns', async () => {
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    const nameColumn = await within(table).findByText('Name');
    const filterTypeColumn = await within(table).findByText('Filter Type');
    const groupKeyColumn = await within(table).findByText('Group Key');
    const clauseColumn = await within(table).findByText('Clause');
    const modifiedColumn = await within(table).findByText('Last modified');
    const actionsColumn = await within(table).findByText('Actions');

    expect(nameColumn).toBeInTheDocument();
    expect(filterTypeColumn).toBeInTheDocument();
    expect(groupKeyColumn).toBeInTheDocument();
    expect(clauseColumn).toBeInTheDocument();
    expect(modifiedColumn).toBeInTheDocument();
    expect(actionsColumn).toBeInTheDocument();
  });

  it('renders correct action buttons with write permission', async () => {
    await renderAndWait();

    const deleteActionIcon = screen.queryAllByTestId('rls-list-trash-icon');
    expect(deleteActionIcon).toHaveLength(2);

    const editActionIcon = screen.queryAllByTestId('edit-alt');
    expect(editActionIcon).toHaveLength(2);
  });

  it('should not renders correct action buttons without write permission', async () => {
    fetchMock.get(
      ruleInfoEndpoint,
      { permissions: ['can_read'] },
      { overwriteRoutes: true },
    );

    await renderAndWait();

    const deleteActionIcon = screen.queryByTestId('rls-list-trash-icon');
    expect(deleteActionIcon).not.toBeInTheDocument();

    const editActionIcon = screen.queryByTestId('edit-alt');
    expect(editActionIcon).not.toBeInTheDocument();

    fetchMock.get(
      ruleInfoEndpoint,
      { permissions: ['can_read', 'can_write'] },
      { overwriteRoutes: true },
    );
  });

  it('renders popover on new clicking rule button', async () => {
    await renderAndWait();

    const modal = screen.queryByTestId('rls-modal-title');
    expect(modal).not.toBeInTheDocument();

    const addRuleButton = await screen.findByTestId('add-rule');
    userEvent.click(addRuleButton);

    const modalAfterClick = screen.queryByTestId('rls-modal-title');
    expect(modalAfterClick).toBeInTheDocument();
  });
});
