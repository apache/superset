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
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { styledMount as mount } from 'spec/helpers/theming';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import ListView from 'src/components/ListView';
import ExecutionLog from 'src/pages/ExecutionLogList';

// store needed for withToasts(ExecutionLog)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const executionLogsEndpoint = 'glob:*/api/v1/report/*/log*';
const reportEndpoint = 'glob:*/api/v1/report/*';

fetchMock.delete(executionLogsEndpoint, {});

const mockannotations = [...new Array(3)].map((_, i) => ({
  end_dttm: new Date().toISOString,
  error_message: `report ${i} error message`,
  id: i,
  scheduled_dttm: new Date().toISOString,
  start_dttm: new Date().toISOString,
  state: 'Success',
  value: `report ${i} value`,
  uuid: 'f44da495-b067-4645-b463-3be98d5f3206',
}));

fetchMock.get(executionLogsEndpoint, {
  ids: [2, 0, 1],
  result: mockannotations,
  count: 3,
});

fetchMock.get(reportEndpoint, {
  id: 1,
  result: { name: 'Test 0' },
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'), // use actual for all non-hook parts
  useParams: () => ({ alertId: '1' }),
}));

async function mountAndWait(props) {
  const mounted = mount(
    <Provider store={store}>
      <ExecutionLog {...props} />
    </Provider>,
  );
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('ExecutionLog', () => {
  let wrapper;

  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(ExecutionLog)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('fetches report/alert', () => {
    const callsQ = fetchMock.calls(/report\/1/);
    expect(callsQ).toHaveLength(2);
    expect(callsQ[1][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/report/1"`,
    );
  });

  it('fetches execution logs', () => {
    const callsQ = fetchMock.calls(/report\/1\/log/);
    expect(callsQ).toHaveLength(1);
    expect(callsQ[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/report/1/log/?q=(order_column:start_dttm,order_direction:desc,page:0,page_size:25)"`,
    );
  });
});
