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

import AnchorLink from 'src/components/AnchorLink';
import URLShortLinkButton from 'src/components/URLShortLinkButton';

describe('AnchorLink', () => {
  const props = {
    anchorLinkId: 'CHART-123',
    dashboardId: 10,
  };

  const globalLocation = window.location;
  afterEach(() => {
    window.location = globalLocation;
  });

  beforeEach(() => {
    delete window.location;
    window.location = new URL(`https://path?#${props.anchorLinkId}`);
  });

  afterEach(() => {
    delete global.window.location.value;
  });

  it('should scroll the AnchorLink into view upon mount', async () => {
    const callback = jest.fn();
    const stub = jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: callback,
    });

    shallow(<AnchorLink {...props} />);
    await new Promise(r => setTimeout(r, 2000));

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('should render anchor link with id', () => {
    const wrapper = shallow(<AnchorLink {...props} />);
    expect(wrapper.find(`#${props.anchorLinkId}`)).toExist();
    expect(wrapper.find(URLShortLinkButton)).not.toExist();
  });

  it('should render URLShortLinkButton', () => {
    const wrapper = shallow(<AnchorLink {...props} showShortLinkButton />);
    expect(wrapper.find(URLShortLinkButton)).toExist();
    expect(wrapper.find(URLShortLinkButton)).toHaveProp({ placement: 'right' });

    const anchorLinkId = wrapper.find(URLShortLinkButton).prop('anchorLinkId');
    const dashboardId = wrapper.find(URLShortLinkButton).prop('dashboardId');
    expect(anchorLinkId).toBe(props.anchorLinkId);
    expect(dashboardId).toBe(props.dashboardId);
  });
});
