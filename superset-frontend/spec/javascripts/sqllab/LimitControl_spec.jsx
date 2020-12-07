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
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { shallow, mount } from 'enzyme';

import Label from 'src/components/Label';
import LimitControl from 'src/SqlLab/components/LimitControl';
import ControlHeader from 'src/explore/components/ControlHeader';
import Popover from 'src/common/components/Popover';

describe('LimitControl', () => {
  const defaultProps = {
    value: 0,
    defaultQueryLimit: 1000,
    maxRow: 100000,
    onChange: () => {},
  };
  let wrapper;
  const factory = o => <LimitControl {...o} />;
  beforeEach(() => {
    wrapper = shallow(factory(defaultProps));
  });
  it('is a valid element', () => {
    expect(React.isValidElement(<LimitControl {...defaultProps} />)).toEqual(
      true,
    );
  });
  it('renders a Label', () => {
    expect(wrapper.find(Label)).toExist();
  });
  it('loads the correct state', () => {
    const value = 100;
    wrapper = shallow(factory({ ...defaultProps, value }));
    expect(wrapper.state().textValue).toEqual(value.toString());
    wrapper.find(Label).first().simulate('click');
    expect(wrapper.find(Popover).props().visible).toBe(true);
    const popoverContentWrapper = mount(wrapper.instance().renderPopover(), {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    });
    expect(
      popoverContentWrapper.find(ControlHeader).props().validationErrors,
    ).toHaveLength(0);
  });
  it('handles invalid value', () => {
    wrapper.find(Label).first().simulate('click');
    wrapper.setState({ textValue: 'invalid' });
    const popoverContentWrapper = mount(wrapper.instance().renderPopover(), {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    });
    expect(
      popoverContentWrapper.find(ControlHeader).props().validationErrors,
    ).toHaveLength(1);
  });
  it('handles negative value', () => {
    wrapper.find(Label).first().simulate('click');
    wrapper.setState({ textValue: '-1' });
    const popoverContentWrapper = mount(wrapper.instance().renderPopover(), {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    });
    expect(
      popoverContentWrapper.find(ControlHeader).props().validationErrors,
    ).toHaveLength(1);
  });
  it('handles value above max row', () => {
    wrapper.find(Label).first().simulate('click');
    wrapper.setState({ textValue: (defaultProps.maxRow + 1).toString() });
    const popoverContentWrapper = mount(wrapper.instance().renderPopover(), {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    });
    expect(
      popoverContentWrapper.find(ControlHeader).props().validationErrors,
    ).toHaveLength(1);
  });
  it('opens and closes', () => {
    wrapper.find(Label).first().simulate('click');
    expect(wrapper.state().showOverlay).toBe(true);
    const popoverContentWrapper = mount(wrapper.instance().renderPopover(), {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    });
    popoverContentWrapper
      .find('[data-test="limit-control-confirm"]')
      .first()
      .simulate('click');
    expect(wrapper.state().showOverlay).toBe(false);
  });
  it('resets and closes', () => {
    const value = 100;
    wrapper = mount(factory({ ...defaultProps, value }), {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    });
    wrapper.find(Label).first().simulate('click');
    expect(wrapper.state().textValue).toEqual(value.toString());
    const popoverContentWrapper = mount(wrapper.instance().renderPopover(), {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    });
    popoverContentWrapper
      .find('[data-test="limit-control-cancel"]')
      .first()
      .simulate('click');
    expect(wrapper.state().textValue).toEqual(
      defaultProps.defaultQueryLimit.toString(),
    );
  });
});
