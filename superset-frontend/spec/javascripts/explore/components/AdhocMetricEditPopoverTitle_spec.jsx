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
/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { Tooltip } from 'src/common/components/Tooltip';

import AdhocMetricEditPopoverTitle from 'src/explore/components/controls/MetricControl/AdhocMetricEditPopoverTitle';

const title = {
  label: 'Title',
  hasCustomLabel: false,
};

function setup(overrides) {
  const onChange = sinon.spy();
  const props = {
    title,
    onChange,
    ...overrides,
  };
  const wrapper = shallow(<AdhocMetricEditPopoverTitle {...props} />);
  return { wrapper, onChange };
}

describe('AdhocMetricEditPopoverTitle', () => {
  it('renders an OverlayTrigger wrapper with the title', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Tooltip)).toExist();
    expect(
      wrapper.find('[data-test="AdhocMetricEditTitle#trigger"]').text(),
    ).toBe(`${title.label}\xa0`);
  });

  it('transfers to edit mode when clicked', () => {
    const { wrapper } = setup();
    expect(wrapper.state('isEditMode')).toBe(false);
    wrapper
      .find('[data-test="AdhocMetricEditTitle#trigger"]')
      .simulate('click');
    expect(wrapper.state('isEditMode')).toBe(true);
  });

  it('Render non-interactive span with title when edit is disabled', () => {
    const { wrapper } = setup({ isEditDisabled: true });
    expect(
      wrapper.find('[data-test="AdhocMetricTitle"]').exists(),
    ).toBeTruthy();
    expect(
      wrapper.find('[data-test="AdhocMetricEditTitle#trigger"]').exists(),
    ).toBeFalsy();
  });
});
