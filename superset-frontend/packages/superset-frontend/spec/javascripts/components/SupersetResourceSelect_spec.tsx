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
import { mount } from 'enzyme';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import SupersetResourceSelect from 'src/components/SupersetResourceSelect';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import fetchMock from 'fetch-mock';

describe('SupersetResourceSelect', () => {
  const NOOP = () => {};

  fetchMock.get('glob:*/api/v1/dataset/?q=*', {});

  it('is a valid element', () => {
    // @ts-ignore
    expect(
      React.isValidElement(<SupersetResourceSelect onError={NOOP} />),
    ).toBe(true);
  });

  it('take in props', () => {
    const mockStore = configureStore([thunk]);
    const store = mockStore({});
    const selectProps = {
      resource: 'dataset',
      searchColumn: 'table_name',
      transformItem: jest.fn(),
      isMulti: false,
      onError: NOOP,
    };
    const wrapper = mount(<SupersetResourceSelect {...selectProps} />, {
      wrappingComponent: ({ children }) => (
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>{children}</Provider>
        </ThemeProvider>
      ),
    });
    expect(wrapper.props().resource).toEqual('dataset');
  });
});
