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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import { styledMount as mount } from 'spec/helpers/theming';
import { render, screen, cleanup } from 'spec/helpers/testing-library';
import { FeatureFlag } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import { QueryParamProvider } from 'use-query-params';
import * as uiCore from '@superset-ui/core';

import DatasetList from 'src/pages/DatasetList';
import ListView from 'src/components/ListView';
import Button from 'src/components/Button';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { act } from 'react-dom/test-utils';
import SubMenu from 'src/features/home/SubMenu';
import * as reactRedux from 'react-redux';

// store needed for withToasts(DatasetList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const datasetsInfoEndpoint = 'glob:*/api/v1/dataset/_info*';
const datasetsOwnersEndpoint = 'glob:*/api/v1/dataset/related/owners*';
const datasetsSchemaEndpoint = 'glob:*/api/v1/dataset/distinct/schema*';
const datasetsDuplicateEndpoint = 'glob:*/api/v1/dataset/duplicate*';
const databaseEndpoint = 'glob:*/api/v1/dataset/related/database*';
const datasetsEndpoint = 'glob:*/api/v1/dataset/?*';

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

const mockdatasets = [...new Array(3)].map((_, i) => ({
  changed_by_name: 'user',
  kind: i === 0 ? 'virtual' : 'physical', // ensure there is 1 virtual
  changed_by: 'user',
  changed_on: new Date().toISOString(),
  database_name: `db ${i}`,
  explore_url: `https://www.google.com?${i}`,
  id: i,
  schema: `schema ${i}`,
  table_name: `coolest table ${i}`,
  owners: [{ username: 'admin', userId: 1 }],
}));

const mockUser = {
  userId: 1,
};

fetchMock.get(datasetsInfoEndpoint, {
  permissions: ['can_read', 'can_write', 'can_duplicate'],
});
fetchMock.get(datasetsOwnersEndpoint, {
  result: [],
});
fetchMock.get(datasetsSchemaEndpoint, {
  result: [],
});
fetchMock.post(datasetsDuplicateEndpoint, {
  result: [],
});
fetchMock.get(datasetsEndpoint, {
  result: mockdatasets,
  dataset_count: 3,
});
fetchMock.get(databaseEndpoint, {
  result: [],
});

async function mountAndWait(props: {}) {
  const mounted = mount(
    <Provider store={store}>
      <DatasetList {...props} user={mockUser} />
    </Provider>,
  );
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('DatasetList', () => {
  const mockedProps = {};
  let wrapper: any;

  beforeAll(async () => {
    wrapper = await mountAndWait(mockedProps);
  });

  it('renders', () => {
    expect(wrapper.find(DatasetList)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('fetches info', () => {
    const callsI = fetchMock.calls(/dataset\/_info/);
    expect(callsI).toHaveLength(1);
  });

  it('fetches data', () => {
    const callsD = fetchMock.calls(/dataset\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/dataset/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('does not fetch owner filter values on mount', async () => {
    await waitForComponentToPaint(wrapper);
    expect(fetchMock.calls(/dataset\/related\/owners/)).toHaveLength(0);
  });

  it('does not fetch schema filter values on mount', async () => {
    await waitForComponentToPaint(wrapper);
    expect(fetchMock.calls(/dataset\/distinct\/schema/)).toHaveLength(0);
  });

  it('shows/hides bulk actions when bulk actions is clicked', async () => {
    await waitForComponentToPaint(wrapper);
    const button = wrapper.find(Button).at(0);
    act(() => {
      button.props().onClick();
    });
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(IndeterminateCheckbox)).toHaveLength(
      mockdatasets.length + 1, // 1 for each row and 1 for select all
    );
  });

  it('renders different bulk selected copy depending on type of row selected', async () => {
    // None selected
    const checkedEvent = { target: { checked: true } };
    const uncheckedEvent = { target: { checked: false } };
    expect(
      wrapper.find('[data-test="bulk-select-copy"]').text(),
    ).toMatchInlineSnapshot(`"0 Selected"`);

    // Virtual Selected
    act(() => {
      wrapper.find(IndeterminateCheckbox).at(1).props().onChange(checkedEvent);
    });
    await waitForComponentToPaint(wrapper);
    expect(
      wrapper.find('[data-test="bulk-select-copy"]').text(),
    ).toMatchInlineSnapshot(`"1 Selected (Virtual)"`);

    // Physical Selected
    act(() => {
      wrapper
        .find(IndeterminateCheckbox)
        .at(1)
        .props()
        .onChange(uncheckedEvent);
      wrapper.find(IndeterminateCheckbox).at(2).props().onChange(checkedEvent);
    });
    await waitForComponentToPaint(wrapper);
    expect(
      wrapper.find('[data-test="bulk-select-copy"]').text(),
    ).toMatchInlineSnapshot(`"1 Selected (Physical)"`);

    // All Selected
    act(() => {
      wrapper.find(IndeterminateCheckbox).at(0).props().onChange(checkedEvent);
    });
    await waitForComponentToPaint(wrapper);
    expect(
      wrapper.find('[data-test="bulk-select-copy"]').text(),
    ).toMatchInlineSnapshot(`"3 Selected (2 Physical, 1 Virtual)"`);
  });

  it('shows duplicate modal when duplicate action is clicked', async () => {
    await waitForComponentToPaint(wrapper);
    expect(
      wrapper.find('[data-test="duplicate-modal-input"]').exists(),
    ).toBeFalsy();
    act(() => {
      wrapper
        .find('#duplicate-action-tooltip')
        .at(0)
        .find('.action-button')
        .props()
        .onClick();
    });
    await waitForComponentToPaint(wrapper);
    expect(
      wrapper.find('[data-test="duplicate-modal-input"]').exists(),
    ).toBeTruthy();
  });

  it('calls the duplicate endpoint', async () => {
    await waitForComponentToPaint(wrapper);
    await act(async () => {
      wrapper
        .find('#duplicate-action-tooltip')
        .at(0)
        .find('.action-button')
        .props()
        .onClick();
      await waitForComponentToPaint(wrapper);
      wrapper
        .find('[data-test="duplicate-modal-input"]')
        .at(0)
        .props()
        .onPressEnter();
    });
    expect(fetchMock.calls(/dataset\/duplicate/)).toHaveLength(1);
  });

  it('renders a SubMenu', () => {
    expect(wrapper.find(SubMenu)).toExist();
  });

  it('renders a SubMenu with no tabs', () => {
    expect(wrapper.find(SubMenu).props().tabs).toBeUndefined();
  });
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({}),
  useHistory: () => ({}),
}));

describe('RTL', () => {
  async function renderAndWait() {
    const mounted = act(async () => {
      const mockedProps = {};
      render(
        <QueryParamProvider>
          <DatasetList {...mockedProps} user={mockUser} />
        </QueryParamProvider>,
        { useRedux: true, useRouter: true },
      );
    });

    return mounted;
  }

  let isFeatureEnabledMock: jest.SpyInstance<boolean, [feature: FeatureFlag]>;
  beforeEach(async () => {
    isFeatureEnabledMock = jest
      .spyOn(uiCore, 'isFeatureEnabled')
      .mockImplementation(() => true);
    await renderAndWait();
  });

  afterEach(() => {
    cleanup();
    isFeatureEnabledMock.mockRestore();
  });

  it('renders an "Import Dataset" tooltip under import button', async () => {
    const importButton = await screen.findByTestId('import-button');
    userEvent.hover(importButton);

    await screen.findByRole('tooltip');
    const importTooltip = screen.getByRole('tooltip', {
      name: 'Import datasets',
    });

    expect(importTooltip).toBeInTheDocument();
  });
});

describe('Prevent unsafe URLs', () => {
  const columnCount = 8;
  const exploreUrlIndex = 1;
  const getTdIndex = (rowNumber: number): number =>
    rowNumber * columnCount + exploreUrlIndex;

  const mockedProps = {};
  let wrapper: any;

  it('Check prevent unsafe is on renders relative links', async () => {
    useSelectorMock.mockReturnValue(true);
    wrapper = await mountAndWait(mockedProps);
    const tdElements = wrapper.find(ListView).find('td');
    expect(tdElements.at(getTdIndex(0)).find('a').prop('href')).toBe(
      '/https://www.google.com?0',
    );
    expect(tdElements.at(getTdIndex(1)).find('a').prop('href')).toBe(
      '/https://www.google.com?1',
    );
    expect(tdElements.at(getTdIndex(2)).find('a').prop('href')).toBe(
      '/https://www.google.com?2',
    );
  });

  it('Check prevent unsafe is off renders absolute links', async () => {
    useSelectorMock.mockReturnValue(false);
    wrapper = await mountAndWait(mockedProps);
    const tdElements = wrapper.find(ListView).find('td');
    expect(tdElements.at(getTdIndex(0)).find('a').prop('href')).toBe(
      'https://www.google.com?0',
    );
    expect(tdElements.at(getTdIndex(1)).find('a').prop('href')).toBe(
      'https://www.google.com?1',
    );
    expect(tdElements.at(getTdIndex(2)).find('a').prop('href')).toBe(
      'https://www.google.com?2',
    );
  });
});
