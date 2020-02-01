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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { OverlayTrigger } from 'react-bootstrap';
import fetchMock from 'fetch-mock';
import { shallow } from 'enzyme';

import * as utils from '../../../src/utils/common';
import Button from '../../../src/components/Button';
import ShareSqlLabQuery from '../../../src/SqlLab/components/ShareSqlLabQuery';

const mockStore = configureStore([thunk]);
const store = mockStore();

describe('ShareSqlLabQuery', () => {
  const storeQueryUrl = 'glob:*/kv/store/';
  const storeQueryMockId = '123';

  beforeEach(() => {
    fetchMock.post(storeQueryUrl, () => ({ id: storeQueryMockId }), {
      overwriteRoutes: true,
    });
    fetchMock.resetHistory();
  });

  afterAll(fetchMock.reset);

  const defaultProps = {
    queryEditor: {
      dbId: 0,
      title: 'query title',
      schema: 'query_schema',
      autorun: false,
      sql: 'SELECT * FROM ...',
    },
  };

  function setup(overrideProps) {
    const wrapper = shallow(
      <ShareSqlLabQuery {...defaultProps} {...overrideProps} />,
      {
        context: { store },
      },
    ).dive(); // wrapped in withToasts HOC

    return wrapper;
  }

  it('renders an OverlayTrigger with Button', () => {
    const wrapper = setup();
    const trigger = wrapper.find(OverlayTrigger);
    const button = trigger.find(Button);

    expect(trigger).toHaveLength(1);
    expect(button).toHaveLength(1);
  });

  it('calls storeQuery() with the query when getCopyUrl() is called and saves the url', () => {
    expect.assertions(4);
    const storeQuerySpy = jest.spyOn(utils, 'storeQuery');

    const wrapper = setup();
    const instance = wrapper.instance();

    return instance.getCopyUrl().then(() => {
      expect(storeQuerySpy.mock.calls).toHaveLength(1);
      expect(fetchMock.calls(storeQueryUrl)).toHaveLength(1);
      expect(storeQuerySpy.mock.calls[0][0]).toMatchObject(
        defaultProps.queryEditor,
      );
      expect(instance.state.shortUrl).toContain(storeQueryMockId);

      return Promise.resolve();
    });
  });

  it('dispatches an error toast upon fetching failure', () => {
    expect.assertions(3);
    const error = 'error';
    const addDangerToastSpy = jest.fn();
    fetchMock.post(storeQueryUrl, { throws: error }, { overwriteRoutes: true });
    const wrapper = setup();
    wrapper.setProps({ addDangerToast: addDangerToastSpy });

    return wrapper
      .instance()
      .getCopyUrl()
      .then(() => {
        expect(fetchMock.calls(storeQueryUrl)).toHaveLength(1);
        expect(addDangerToastSpy.mock.calls).toHaveLength(1);
        expect(addDangerToastSpy.mock.calls[0][0]).toBe(error);

        return Promise.resolve();
      });
  });
});
