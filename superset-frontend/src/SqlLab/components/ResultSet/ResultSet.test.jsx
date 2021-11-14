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
import { shallow } from 'enzyme';
import { styledMount } from 'spec/helpers/theming';
import { render, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import sinon from 'sinon';
import Alert from 'src/components/Alert';
import ProgressBar from 'src/components/ProgressBar';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';
import FilterableTable from 'src/components/FilterableTable/FilterableTable';
import ExploreResultsButton from 'src/SqlLab/components/ExploreResultsButton';
import ResultSet from 'src/SqlLab/components/ResultSet';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import {
  cachedQuery,
  failedQueryWithErrorMessage,
  failedQueryWithErrors,
  queries,
  runningQuery,
  stoppedQuery,
  initialState,
  user,
  queryWithNoQueryLimit,
} from 'src/SqlLab/fixtures';

const mockStore = configureStore([thunk]);
const store = mockStore(initialState);
const clearQuerySpy = sinon.spy();
const fetchQuerySpy = sinon.spy();
const reRunQuerySpy = sinon.spy();
const mockedProps = {
  actions: {
    clearQueryResults: clearQuerySpy,
    fetchQueryResults: fetchQuerySpy,
    reRunQuery: reRunQuerySpy,
  },
  cache: true,
  query: queries[0],
  height: 140,
  database: { allows_virtual_table_explore: true },
  user,
  defaultQueryLimit: 1000,
};
const stoppedQueryProps = { ...mockedProps, query: stoppedQuery };
const runningQueryProps = { ...mockedProps, query: runningQuery };
const cachedQueryProps = { ...mockedProps, query: cachedQuery };
const failedQueryWithErrorMessageProps = {
  ...mockedProps,
  query: failedQueryWithErrorMessage,
};
const failedQueryWithErrorsProps = {
  ...mockedProps,
  query: failedQueryWithErrors,
};
const newProps = {
  query: {
    cached: false,
    resultsKey: 'new key',
    results: {
      data: [{ a: 1 }],
    },
  },
};
fetchMock.get('glob:*/api/v1/dataset?*', { result: [] });

test('is valid', () => {
  expect(React.isValidElement(<ResultSet {...mockedProps} />)).toBe(true);
});

test('renders a Table', () => {
  const wrapper = shallow(<ResultSet {...mockedProps} />);
  expect(wrapper.find(FilterableTable)).toExist();
});

describe('componentDidMount', () => {
  const propsWithError = {
    ...mockedProps,
    query: { ...queries[0], errorMessage: 'Your session timed out' },
  };
  let spy;
  beforeEach(() => {
    reRunQuerySpy.resetHistory();
    spy = sinon.spy(ResultSet.prototype, 'componentDidMount');
  });
  afterEach(() => {
    spy.restore();
  });
  it('should call reRunQuery if timed out', () => {
    shallow(<ResultSet {...propsWithError} />);
    expect(reRunQuerySpy.callCount).toBe(1);
  });

  it('should not call reRunQuery if no error', () => {
    shallow(<ResultSet {...mockedProps} />);
    expect(reRunQuerySpy.callCount).toBe(0);
  });
});

describe('UNSAFE_componentWillReceiveProps', () => {
  const wrapper = shallow(<ResultSet {...mockedProps} />);
  let spy;
  beforeEach(() => {
    clearQuerySpy.resetHistory();
    fetchQuerySpy.resetHistory();
    spy = sinon.spy(ResultSet.prototype, 'UNSAFE_componentWillReceiveProps');
  });
  afterEach(() => {
    spy.restore();
  });
  it('should update cached data', () => {
    wrapper.setProps(newProps);

    expect(wrapper.state().data).toEqual(newProps.query.results.data);
    expect(clearQuerySpy.callCount).toBe(1);
    expect(clearQuerySpy.getCall(0).args[0]).toEqual(newProps.query);
    expect(fetchQuerySpy.callCount).toBe(1);
    expect(fetchQuerySpy.getCall(0).args[0]).toEqual(newProps.query);
  });
});

test('should render success query', () => {
  const wrapper = shallow(<ResultSet {...mockedProps} />);
  const filterableTable = wrapper.find(FilterableTable);
  expect(filterableTable.props().data).toBe(mockedProps.query.results.data);
  expect(wrapper.find(ExploreResultsButton)).toExist();
});
test('should render empty results', () => {
  const props = {
    ...mockedProps,
    query: { ...mockedProps.query, results: { data: [] } },
  };
  const wrapper = styledMount(
    <Provider store={store}>
      <ResultSet {...props} />
    </Provider>,
  );
  expect(wrapper.find(FilterableTable)).not.toExist();
  expect(wrapper.find(Alert)).toExist();
  expect(wrapper.find(Alert).render().text()).toBe(
    'The query returned no data',
  );
});

test('should render cached query', () => {
  const wrapper = shallow(<ResultSet {...cachedQueryProps} />);
  const cachedData = [{ col1: 'a', col2: 'b' }];
  wrapper.setState({ data: cachedData });
  const filterableTable = wrapper.find(FilterableTable);
  expect(filterableTable.props().data).toBe(cachedData);
});

test('should render stopped query', () => {
  const wrapper = shallow(<ResultSet {...stoppedQueryProps} />);
  expect(wrapper.find(Alert)).toExist();
});

test('should render running/pending/fetching query', () => {
  const wrapper = shallow(<ResultSet {...runningQueryProps} />);
  expect(wrapper.find(ProgressBar)).toExist();
});

test('should render a failed query with an error message', () => {
  const wrapper = shallow(<ResultSet {...failedQueryWithErrorMessageProps} />);
  expect(wrapper.find(ErrorMessageWithStackTrace)).toExist();
});

test('should render a failed query with an errors object', () => {
  const wrapper = shallow(<ResultSet {...failedQueryWithErrorsProps} />);
  expect(wrapper.find(ErrorMessageWithStackTrace)).toExist();
});

test('renders if there is no limit in query.results but has queryLimit', () => {
  render(<ResultSet {...mockedProps} />, { useRedux: true });
  expect(screen.getByRole('grid')).toBeInTheDocument();
});

test('renders if there is a limit in query.results but not queryLimit', () => {
  const props = { ...mockedProps, query: queryWithNoQueryLimit };
  render(<ResultSet {...props} />, { useRedux: true });
  expect(screen.getByRole('grid')).toBeInTheDocument();
});
