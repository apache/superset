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
import { styledMount as mount } from 'spec/helpers/theming';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import AlertRunbook from '.';

describe('AlertRunbook', () => {
  let wrapper;
  let title = 'Reports Run book';

  it('renders the component with title Reports Runbook', () => {
    const wrapper = mount(<AlertRunbook title={title} />);
    expect(wrapper.text()).toEqual(title);
  });

  it('renders the component with title Alerts Runbook', () => {
    title = 'Alerts Run book';
    const wrapper = mount(<AlertRunbook title={title} />);
    expect(wrapper.text()).toEqual(title);
  });

  it('renders a refresh action', async () => {
    const RUNBOOK_URL = 'https://example.com/runbook';
    const mockAction = jest.fn();
    Object.defineProperty(window, 'open', {
      value: mockAction,
      writable: true,
    });
    wrapper = mount(<AlertRunbook title={title} />);
    await waitForComponentToPaint(wrapper);
    const props = wrapper.find('[data-test="runbook-action"]').first().props();
    console.log('PROPS==', props);
    if (props.onClick) {
      props.onClick();
    }
    expect(mockAction).toHaveBeenCalledWith(
      RUNBOOK_URL,
      '_blank',
      'noreferrer',
    );
  });
});
