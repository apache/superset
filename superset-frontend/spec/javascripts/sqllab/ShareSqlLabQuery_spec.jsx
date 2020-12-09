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
import Popover from 'src/common/components/Popover';
import fetchMock from 'fetch-mock';
import * as featureFlags from 'src/featureFlags';
import { shallow } from 'enzyme';

import * as utils from 'src/utils/common';
import Button from 'src/components/Button';
import ShareSqlLabQuery from 'src/SqlLab/components/ShareSqlLabQuery';

const mockStore = configureStore([thunk]);
const store = mockStore();
let isFeatureEnabledMock;

describe('ShareSqlLabQuery via /kv/store', () => {
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
      remoteId: 999,
    },
  };

  const storedQueryAttributes = {
    dbId: 0,
    title: 'query title',
    schema: 'query_schema',
    autorun: false,
    sql: 'SELECT * FROM ...',
  };

  function setup(overrideProps) {
    const wrapper = shallow(
      <ShareSqlLabQuery store={store} {...defaultProps} {...overrideProps} />,
    ).dive(); // wrapped in withToasts HOC

    return wrapper;
  }

  describe('via /kv/store', () => {
    beforeAll(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(() => true);
    });

    afterAll(() => {
      isFeatureEnabledMock.restore();
    });

    it('renders an OverlayTrigger with Button', () => {
      const wrapper = setup();
      const trigger = wrapper.find(Popover);
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
          storedQueryAttributes,
        );
        expect(instance.state.shortUrl).toContain(storeQueryMockId);

        storeQuerySpy.mockRestore();

        return Promise.resolve();
      });
    });

    it('dispatches an error toast upon fetching failure', () => {
      expect.assertions(3);
      const error = 'error';
      const addDangerToastSpy = jest.fn();
      fetchMock.post(
        storeQueryUrl,
        { throws: error },
        { overwriteRoutes: true },
      );
      const wrapper = setup();
      wrapper.setProps({ addDangerToast: addDangerToastSpy });

      return wrapper
        .instance()
        .getCopyUrl()
        .then(() => {
          // Fails then retries thrice
          expect(fetchMock.calls(storeQueryUrl)).toHaveLength(4);
          expect(addDangerToastSpy.mock.calls).toHaveLength(1);
          expect(addDangerToastSpy.mock.calls[0][0]).toBe(error);

          return Promise.resolve();
        });
    });
  });
  describe('via saved query', () => {
    beforeAll(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(() => false);
    });

    afterAll(() => {
      isFeatureEnabledMock.restore();
    });

    it('renders an OverlayTrigger with Button', () => {
      const wrapper = setup();
      const trigger = wrapper.find(Popover);
      const button = trigger.find(Button);

      expect(trigger).toHaveLength(1);
      expect(button).toHaveLength(1);
    });

    it('does not call storeQuery() with the query when getCopyUrl() is called', () => {
      const storeQuerySpy = jest.spyOn(utils, 'storeQuery');

      const wrapper = setup();
      const instance = wrapper.instance();

      instance.getCopyUrl();

      expect(storeQuerySpy.mock.calls).toHaveLength(0);
      expect(fetchMock.calls(storeQueryUrl)).toHaveLength(0);
      expect(instance.state.shortUrl).toContain(999);

      storeQuerySpy.mockRestore();
    });

    it('shows a request to save the query when the query is not yet saved', () => {
      const wrapper = setup({ remoteId: undefined });
      const instance = wrapper.instance();

      instance.getCopyUrl();

      expect(instance.state.shortUrl).toContain('save');
    });
  });
});
