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
import sinon from 'sinon';

import AnchorLink from '../../../src/components/AnchorLink';
import URLShortLinkButton from '../../../src/components/URLShortLinkButton';

describe('AnchorLink', () => {
  const props = {
    anchorLinkId: 'CHART-123',
  };

  it('should scroll the AnchorLink into view upon mount', () => {
    const callback = sinon.spy();
    const clock = sinon.useFakeTimers();
    const stub = sinon.stub(document, 'getElementById').returns({
      scrollIntoView: callback,
    });

    const wrapper = shallow(<AnchorLink {...props} />);
    wrapper.instance().getLocationHash = () => (props.anchorLinkId);
    wrapper.update();

    wrapper.instance().componentDidMount();
    clock.tick(2000);
    expect(callback.callCount).toEqual(1);
    stub.restore();
  });

  it('should render anchor link with id', () => {
    const wrapper = shallow(<AnchorLink {...props} />);
    expect(wrapper.find(`#${props.anchorLinkId}`)).toHaveLength(1);
    expect(wrapper.find(URLShortLinkButton)).toHaveLength(0);
  });

  it('should render URLShortLinkButton', () => {
    const wrapper = shallow(<AnchorLink {...props} showShortLinkButton />);
    expect(wrapper.find(URLShortLinkButton)).toHaveLength(1);
    expect(wrapper.find(URLShortLinkButton).prop('placement')).toBe('right');

    const targetUrl = wrapper.find(URLShortLinkButton).prop('url');
    const hash = targetUrl.slice(targetUrl.indexOf('#') + 1);
    expect(hash).toBe(props.anchorLinkId);
  });
});
