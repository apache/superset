import React from 'react';
import { mount } from 'enzyme';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { Table } from 'reactable';

import DashboardTable from '../../../src/welcome/DashboardTable';
import Loading from '../../../src/components/Loading';

// store needed for withToasts(TableLoader)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const dashboardsEndpoint = 'glob:*/dashboardasync/api/read*';
const mockDashboards = [
  { id: 1, url: 'url', dashboard_title: 'title' },
];

fetchMock.get(dashboardsEndpoint, { result: mockDashboards });

function setup() {
  // use mount because data fetching is triggered on mount
  return mount(<DashboardTable />, { context: { store } });
}

describe('DashboardTable', () => {
  afterEach(fetchMock.resetHistory);

  it('renders a Loading initially', () => {
    const wrapper = setup();
    expect(wrapper.find(Loading)).toHaveLength(1);
  });

  it('fetches dashboards and renders a Table', (done) => {
    const wrapper = setup();

    setTimeout(() => {
      expect(fetchMock.calls(dashboardsEndpoint)).toHaveLength(1);
      // there's a delay between response and updating state, so manually set it
      // rather than adding a timeout which could introduce flakiness
      wrapper.setState({ dashaboards: mockDashboards });
      expect(wrapper.find(Table)).toHaveLength(1);
      done();
    });
  });
});
