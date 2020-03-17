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
import { Overlay, Tooltip } from 'react-bootstrap';

import FilterTooltipWrapper from '../../../../src/dashboard/components/FilterTooltipWrapper';
import FilterIndicatorTooltip from '../../../../src/dashboard/components/FilterIndicatorTooltip';

describe('FilterTooltipWrapper', () => {
  const mockedProps = {
    tooltip: (
      <FilterIndicatorTooltip
        label="region"
        values={['a', 'b', 'c']}
        clickIconHandler={jest.fn()}
      />
    ),
  };

  function setup() {
    return shallow(
      <FilterTooltipWrapper {...mockedProps}>
        <div className="badge-1" />
      </FilterTooltipWrapper>,
    );
  }

  it('should contain Overlay and Tooltip', () => {
    const wrapper = setup();
    expect(wrapper.find(Overlay)).toHaveLength(1);
    expect(wrapper.find(Tooltip)).toHaveLength(1);
  });

  it('should show tooltip on hover', async () => {
    const wrapper = setup();
    wrapper.instance().isHover = true;

    wrapper.find('.indicator-container').simulate('mouseover');
    await new Promise(r => setTimeout(r, 101));
    expect(wrapper.state('show')).toBe(true);
  });

  it('should hide tooltip on hover', async () => {
    const wrapper = setup();
    wrapper.instance().isHover = false;

    wrapper.find('.indicator-container').simulate('mouseout');
    await new Promise(r => setTimeout(r, 101));
    expect(wrapper.state('show')).toBe(false);
  });
});
