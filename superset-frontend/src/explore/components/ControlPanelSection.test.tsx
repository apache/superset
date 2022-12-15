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
import { promiseTimeout } from '@superset-ui/core';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import Collapse from 'src/components/Collapse';
import { ControlPanelSection } from './ControlPanelSection';

const defaultProps = {
  sectionId: 'query',
  hasErrors: false,
  errorColor: '#E04355',
  section: {
    label: 'mock section',
    controlSetRows: [],
  },
  isVisible: true,
  renderControl: jest.fn(),
  actions: {
    setControlValue: jest.fn(),
  },
};

const setup = (overrides = {}) => (
  <Collapse defaultActiveKey={['query']}>
    <ControlPanelSection {...defaultProps} {...overrides} />
  </Collapse>
);

it('should render component', () => {
  render(setup());
  expect(screen.getByText('mock section')).toBeInTheDocument();
});

it('should render as disabled if isDisabled is true', () => {
  render(
    setup({
      isDisabled: true,
      disabledMessages: ['Disabled message'],
    }),
  );
  expect(screen.getByTestId('disabled-section-tooltip')).toBeInTheDocument();
});

it('should call renderControl properly', () => {
  render(
    setup({
      section: {
        label: 'mock section',
        controlSetRows: [
          [null],
          [<div />],
          [{ name: 'control', config: { type: 'CheckboxControl' } }],
          [{ name: 'datasource', config: {} }],
        ],
      },
    }),
  );
  expect(defaultProps.renderControl).toBeCalledTimes(1);
});

it('should call setControlValue if isDisabled is false', () => {
  render(
    setup({
      isDisabled: false,
    }),
  );

  promiseTimeout(() => {
    expect(defaultProps.actions.setControlValue).toBeCalled();
  }, 100);
});
