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
import { shallow, mount } from 'enzyme';
import { mockStore } from 'spec/fixtures/mockStore';
import ExploreActionButtons from 'src/explore/components/ExploreActionButtons';
import * as exploreUtils from 'src/explore/exploreUtils';

import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Provider } from 'react-redux';
import sinon from 'sinon';

describe('ExploreActionButtons', () => {
  const defaultProps = {
    actions: {},
    canDownloadCSV: 'True',
    latestQueryFormData: {},
    queryEndpoint: 'localhost',
    chartHeight: '30px',
  };

  it('renders', () => {
    expect(
      React.isValidElement(<ExploreActionButtons {...defaultProps} />),
    ).toBe(true);
  });

  it('should render 6 children/buttons', () => {
    const wrapper = shallow(
      <ExploreActionButtons {...defaultProps} store={mockStore} />,
    );
    expect(wrapper.dive().children()).toHaveLength(6);
  });

  describe('ExploreActionButtons and no permission to download CSV', () => {
    let wrapper;
    const defaultProps = {
      actions: {},
      canDownloadCSV: false,
      latestQueryFormData: {},
      queryEndpoint: 'localhost',
      chartHeight: '30px',
    };

    beforeEach(() => {
      wrapper = mount(
        <ThemeProvider theme={supersetTheme}>
          <ExploreActionButtons {...defaultProps} />
        </ThemeProvider>,
        {
          wrappingComponent: Provider,
          wrappingComponentProps: {
            store: mockStore,
          },
        },
      );
    });

    it('should render csv buttons but is disabled and not clickable', () => {
      const spyExportChart = sinon.spy(exploreUtils, 'exportChart');

      const csvButton = wrapper.find('div.disabled');
      expect(wrapper).toHaveLength(1);
      csvButton.simulate('click');
      expect(spyExportChart.callCount).toBe(0);
      spyExportChart.restore();
    });
  });
});
