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
import { mount } from 'enzyme';
import {
  ThemeProvider,
  supersetTheme,
  promiseTimeout,
} from '@superset-ui/core';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import Control, { ControlProps } from 'src/explore/components/Control';

const defaultProps: ControlProps = {
  type: 'CheckboxControl',
  name: 'checkbox',
  value: true,
  actions: {
    setControlValue: jest.fn(),
  },
};

const setup = (overrides = {}) => (
  <ThemeProvider theme={supersetTheme}>
    <Control {...defaultProps} {...overrides} />
  </ThemeProvider>
);

describe('Control', () => {
  it('render a control', () => {
    render(setup());

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeVisible();
  });

  it('render null if type is not exit', () => {
    render(
      setup({
        type: undefined,
      }),
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('render null if type is not valid', () => {
    render(
      setup({
        type: 'UnknownControl',
      }),
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('render null if isVisible is false', () => {
    render(
      setup({
        isVisible: false,
      }),
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('call setControlValue if isVisible is false', () => {
    const wrapper = mount(
      setup({
        isVisible: true,
        default: false,
      }),
    );
    wrapper.setProps({
      isVisible: false,
      default: false,
    });
    promiseTimeout(() => {
      expect(defaultProps.actions.setControlValue).toBeCalled();
    }, 100);
  });
});
