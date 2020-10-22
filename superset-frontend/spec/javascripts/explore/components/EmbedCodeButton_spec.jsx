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
import Popover from 'src/common/components/Popover';
import sinon from 'sinon';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

import EmbedCodeButton from 'src/explore/components/EmbedCodeButton';
import * as exploreUtils from 'src/explore/exploreUtils';
import * as common from 'src/utils/common';

describe('EmbedCodeButton', () => {
  const mockStore = configureStore([]);
  const store = mockStore({});

  const defaultProps = {
    latestQueryFormData: { datasource: '107__table' },
  };

  it('renders', () => {
    expect(React.isValidElement(<EmbedCodeButton {...defaultProps} />)).toBe(
      true,
    );
  });

  it('renders overlay trigger', () => {
    const wrapper = shallow(<EmbedCodeButton {...defaultProps} />);
    expect(wrapper.find(Popover)).toExist();
  });

  it('should create a short, standalone, explore url', () => {
    const spy1 = sinon.spy(exploreUtils, 'getExploreLongUrl');
    const spy2 = sinon.spy(common, 'getShortUrl');

    const wrapper = mount(<EmbedCodeButton {...defaultProps} />, {
      wrappingComponent: Provider,
      wrappingComponentProps: {
        store,
      },
    });
    wrapper.setState({
      height: '1000',
      width: '2000',
      shortUrlId: 100,
    });

    const trigger = wrapper.find(Popover);
    trigger.simulate('click');
    expect(spy1.callCount).toBe(1);
    expect(spy2.callCount).toBe(1);

    spy1.restore();
    spy2.restore();
  });

  it('returns correct embed code', () => {
    const stub = sinon
      .stub(exploreUtils, 'getURIDirectory')
      .callsFake(() => 'endpoint_url');
    const wrapper = mount(<EmbedCodeButton {...defaultProps} />);
    wrapper.setState({
      height: '1000',
      width: '2000',
      shortUrlId: 100,
    });
    const embedHTML =
      '<iframe\n' +
      '  width="2000"\n' +
      '  height="1000"\n' +
      '  seamless\n' +
      '  frameBorder="0"\n' +
      '  scrolling="no"\n' +
      '  src="http://localhostendpoint_url?r=100&standalone=true&height=1000"\n' +
      '>\n' +
      '</iframe>';
    expect(wrapper.instance().generateEmbedHTML()).toBe(embedHTML);
    stub.restore();
  });
});
