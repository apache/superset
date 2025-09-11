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
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import { Store } from 'redux';
import { SupersetClientClass } from '@superset-ui/core';
import { initialState } from 'src/SqlLab/fixtures';

import ExploreCtasResultsButton, {
  ExploreCtasResultsButtonProps,
} from 'src/SqlLab/components/ExploreCtasResultsButton';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

const getOrCreateTableEndpoint = `glob:*/api/v1/dataset/get_or_create/`;

const setup = (props: Partial<ExploreCtasResultsButtonProps>, store?: Store) =>
  render(
    <ExploreCtasResultsButton
      table="test"
      schema="test_schema"
      dbId={12346}
      {...props}
    />,
    {
      useRedux: true,
      ...(store && { store }),
    },
  );

describe('ExploreCtasResultsButton', () => {
  const postFormSpy = jest.spyOn(SupersetClientClass.prototype, 'postForm');
  postFormSpy.mockImplementation(jest.fn());

  it('renders', async () => {
    const { queryByText } = setup({}, mockStore(initialState));

    expect(queryByText('Explore')).toBeTruthy();
  });

  it('visualize results', async () => {
    const { getByText } = setup({}, mockStore(initialState));

    postFormSpy.mockClear();
    fetchMock.reset();
    fetchMock.post(getOrCreateTableEndpoint, { result: { table_id: 1234 } });

    fireEvent.click(getByText('Explore'));

    await waitFor(() => {
      expect(postFormSpy).toHaveBeenCalledTimes(1);
      expect(postFormSpy).toHaveBeenCalledWith('http://localhost/explore/', {
        form_data:
          '{"datasource":"1234__table","metrics":["count"],"groupby":[],"viz_type":"table","since":"100 years ago","all_columns":[],"row_limit":1000}',
      });
    });
  });

  it('visualize results fails', async () => {
    const { getByText } = setup({}, mockStore(initialState));

    postFormSpy.mockClear();
    fetchMock.reset();
    fetchMock.post(getOrCreateTableEndpoint, {
      throws: new Error('Unexpected all to v1 API'),
    });

    fireEvent.click(getByText('Explore'));

    await waitFor(() => {
      expect(postFormSpy).toHaveBeenCalledTimes(0);
    });
  });
});
