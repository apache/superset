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
import { render, screen } from 'spec/helpers/testing-library';
import sinon from 'sinon';
import Alert from 'src/components/Alert';
import ProgressBar from 'src/components/ProgressBar';
import Loading from 'src/components/Loading';
import configureStore from 'redux-mock-store';
import { Store } from 'redux';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';
import ResultSet, { ResultSetProps } from 'src/SqlLab/components/ResultSet';
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
const fetchingQueryProps = {
  ...mockedProps,
  query: {
    dbId: 1,
    cached: false,
    ctas: false,
    id: 'ryhHUZCGb',
    progress: 100,
    state: 'fetching',
    startDttm: Date.now() - 500,
  },
};
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

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const setup = (props?: Partial<ResultSetProps>, store?: Store) =>
  render(<ResultSet {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

describe('ResultSet', () => {
  it('renders a Table', async () => {
    const { baseElement } = setup(mockedProps, mockStore(initialState));
    const table = baseElement.getElementsByClassName(
      'filterable-table-container',
    )[0];

    expect(table).toBeInTheDocument();
  });

  it('should render success query', async () => {
    const { baseElement, queryAllByText, getByTestId } = setup(mockedProps, mockStore(initialState));
    const table = baseElement.getElementsByClassName(
      'filterable-table-container',
    )[0];

    expect(table).toBeInTheDocument();

    const firstColumn = queryAllByText(
      mockedProps.query.results?.columns[0].name ?? '',
    )[0];
    const secondColumn = queryAllByText(
      mockedProps.query.results?.columns[1].name ?? '',
    )[0];
    expect(firstColumn).toBeInTheDocument();
    expect(secondColumn).toBeInTheDocument();

    const exploreButton = getByTestId('explore-results-button');
    expect(exploreButton).toBeInTheDocument();
  });

  it('should render empty results', async () => {
    const props = {
      ...mockedProps,
      query: { ...mockedProps.query, results: { data: [] } },
    };
    const { baseElement, getByRole } = setup(props, mockStore(initialState));
    const table = baseElement.getElementsByClassName(
      'filterable-table-container',
    )[0];

    expect(table).toBeUndefined();

    const alert = getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('The query returned no data');
  });

  it('should call reRunQuery if timed out', async () => {
    const propsWithError = {
      ...mockedProps,
      query: { ...queries[0], errorMessage: 'Your session timed out' },
    };

    setup(propsWithError, mockStore(initialState));
    screen.debug();
  });

  it('should not call reRunQuery if no error', async () => {
    setup(mockedProps, mockStore(initialState));
    screen.debug();
  });

  it('should render cached query', async () => {
    const { rerender } = setup(cachedQueryProps, mockStore(initialState));

    screen.debug();
    rerender(<ResultSet {...newProps} />);
    screen.debug();
  });
});

test('should render stopped query', () => {
  const wrapper = shallow(<ResultSet {...stoppedQueryProps} />);
  expect(wrapper.find(Alert)).toExist();
});

test('should render running/pending/fetching query', () => {
  const wrapper = shallow(<ResultSet {...runningQueryProps} />);
  expect(wrapper.find(ProgressBar)).toExist();
});

test('should render fetching w/ 100 progress query', () => {
  const wrapper = shallow(<ResultSet {...fetchingQueryProps} />);
  expect(wrapper.find(Loading)).toExist();
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
